// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title EarmarkPockets
/// @notice Purpose-bound USDC pockets for money sent home. A sponsor creates a labelled pocket, anyone can fund it,
///         and one family member (the spender) pays from it within a per-period limit. Anything above the rules
///         becomes a request the sponsor approves or declines. The sponsor can take unspent money back, except while
///         an optional commitment lock runs. Each pocket keeps the spender's wallet topped up with a small USDC
///         float for network fees, which on Arc are paid in USDC.
/// @dev Immutable: no owner, no admin, no pause, no upgrade, no delegatecall, no selfdestruct, no payable function
///      and no receive(), so native value sent to the contract reverts. USDC moves only through the 6-decimal ERC-20
///      interface (on Arc: 0x3600000000000000000000000000000000000000) using SafeERC20.
///      Every pocket event after PocketCreated carries `prevEventBlock`, the block of that pocket's previous event,
///      so an app can rebuild a pocket's history by reading one block at a time instead of scanning ranges.
contract EarmarkPockets is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ------------------------------------------------------------------ types

    /// @notice One labelled balance of USDC with its own rules. Amounts are USDC base units (6 decimals).
    struct Pocket {
        address sponsor; // creator: sets rules, approves, withdraws
        bool payeeOnly; // spending limited to approved payees
        uint8 icon; // index into the app's pocket icon set, below ICON_COUNT
        uint8 hue; // index into the app's pocket hues, below HUE_COUNT
        address spender; // family member who pays from the pocket
        uint128 balance;
        uint128 limitPerPeriod; // 0 = request-only pocket
        uint128 spentInPeriod;
        uint128 fuelTarget; // fee credit float kept in the spender's wallet, max 500_000 (0.50 USDC)
        uint128 fuelCapPerPeriod; // most the pocket tops up per period, max 1_000_000 (1.00 USDC)
        uint128 fuelUsedInPeriod;
        uint64 periodLength; // seconds, 1 to 31 days
        uint64 periodStart;
        uint64 lockUntil; // 0 = no commitment lock
        uint64 lastEventBlock; // back-pointer that powers the activity feed
        string label; // 1 to 32 bytes
    }

    enum Status {
        None,
        Pending,
        Approved,
        Declined,
        Cancelled
    }

    /// @notice A payment the spender asked for that the sponsor decides on.
    struct Request {
        uint256 pocketId;
        address to;
        uint128 amount;
        Status status;
        string memo; // at most 64 bytes
    }

    /// @notice Everything needed to create a pocket.
    struct CreateParams {
        address spender;
        string label;
        uint128 limitPerPeriod;
        uint64 periodLength;
        uint64 lockUntil;
        bool payeeOnly;
        uint128 fuelTarget;
        uint128 fuelCapPerPeriod;
        uint128 deposit; // pulled with transferFrom; needs a prior exact-amount approval
        uint8 icon;
        uint8 hue;
    }

    // ------------------------------------------------------------------ constants

    uint256 public constant MAX_LABEL_BYTES = 32;
    uint256 public constant MAX_MEMO_BYTES = 64;
    uint64 public constant MIN_PERIOD = 1 days;
    uint64 public constant MAX_PERIOD = 31 days;
    uint64 public constant MAX_LOCK_AHEAD = 730 days;
    uint128 public constant MAX_FUEL_TARGET = 500_000;
    uint128 public constant MAX_FUEL_CAP = 1_000_000;
    uint256 public constant MAX_PAYEES = 10;
    uint256 public constant MAX_PENDING = 20;
    uint8 public constant ICON_COUNT = 10;
    uint8 public constant HUE_COUNT = 6;

    // ------------------------------------------------------------------ storage

    /// @notice The USDC ERC-20 interface (6 decimals).
    IERC20 public immutable usdc;

    /// @notice Number of pockets created; ids start at 1.
    uint256 public pocketCount;
    /// @notice Number of requests made; ids start at 1.
    uint256 public requestCount;

    mapping(uint256 pocketId => Pocket) private _pockets;
    mapping(uint256 requestId => Request) private _requests;
    mapping(uint256 pocketId => mapping(address payee => bool)) private _isPayee;
    mapping(uint256 pocketId => address[]) private _payeeList;
    mapping(address sponsor => uint256[]) private _pocketsBySponsor;
    mapping(address spender => uint256[]) private _pocketsBySpender;
    mapping(uint256 pocketId => uint256[]) private _requestsByPocket;
    mapping(uint256 pocketId => uint256) private _pendingCount;

    // ------------------------------------------------------------------ events

    event PocketCreated(
        uint256 indexed pocketId,
        address indexed sponsor,
        address indexed spender,
        string label,
        uint128 limitPerPeriod,
        uint64 periodLength,
        uint64 lockUntil,
        bool payeeOnly,
        uint8 icon,
        uint8 hue
    );
    event Funded(uint256 indexed pocketId, address indexed from, uint128 amount, uint64 prevEventBlock);
    event Spent(uint256 indexed pocketId, address indexed to, uint128 amount, string memo, uint64 prevEventBlock);
    event Requested(
        uint256 indexed pocketId,
        uint256 indexed requestId,
        address to,
        uint128 amount,
        string memo,
        uint64 prevEventBlock
    );
    event Approved(uint256 indexed pocketId, uint256 indexed requestId, uint64 prevEventBlock);
    event Declined(uint256 indexed pocketId, uint256 indexed requestId, uint64 prevEventBlock);
    event Cancelled(uint256 indexed pocketId, uint256 indexed requestId, uint64 prevEventBlock);
    event Withdrawn(uint256 indexed pocketId, address indexed to, uint128 amount, uint64 prevEventBlock);
    event Refuelled(uint256 indexed pocketId, address indexed spender, uint128 amount, uint64 prevEventBlock);
    event LockExtended(uint256 indexed pocketId, uint64 lockUntil, uint64 prevEventBlock);
    event PayeeSet(uint256 indexed pocketId, address indexed payee, bool allowed, uint64 prevEventBlock);
    event LimitChanged(uint256 indexed pocketId, uint128 limitPerPeriod, uint64 prevEventBlock);

    // ------------------------------------------------------------------ errors

    error NotSponsor();
    error NotSpender();
    error UnknownPocket();
    error InvalidAddress();
    error InvalidAmount();
    error BadLabel();
    error MemoTooLong();
    error BadPeriod();
    error BadLock();
    error LockNotExtended();
    error Locked(uint64 until);
    error OverLimit(uint128 available);
    error InsufficientBalance(uint128 balance);
    error PayeeNotApproved();
    error TooManyPayees();
    error TooManyPending();
    error NotPending();
    error FuelOutOfRange();
    error BadAppearance();
    error BadToken();

    // ------------------------------------------------------------------ constructor

    /// @param usdc_ The USDC ERC-20 interface. Must report 6 decimals.
    constructor(IERC20Metadata usdc_) {
        if (usdc_.decimals() != 6) revert BadToken();
        usdc = IERC20(address(usdc_));
    }

    // ------------------------------------------------------------------ writes

    /// @notice Creates a pocket. The caller becomes its sponsor.
    /// @dev Pulls `p.deposit` with transferFrom (needs an exact-amount approval first) and credits the amount actually
    ///      received. Then tops up the spender's fee credit if it is below half of `p.fuelTarget`.
    /// @param p The pocket's spender, label, rules, fee credit, first deposit and appearance.
    /// @param payees Approved payees (at most 10). Duplicates are stored once.
    /// @return id The new pocket's id.
    function createPocket(CreateParams calldata p, address[] calldata payees)
        external
        nonReentrant
        returns (uint256 id)
    {
        _checkRecipient(p.spender);
        uint256 labelBytes = bytes(p.label).length;
        if (labelBytes == 0 || labelBytes > MAX_LABEL_BYTES) revert BadLabel();
        if (p.periodLength < MIN_PERIOD || p.periodLength > MAX_PERIOD) revert BadPeriod();
        if (p.lockUntil != 0 && (p.lockUntil <= block.timestamp || p.lockUntil > block.timestamp + MAX_LOCK_AHEAD)) {
            revert BadLock();
        }
        if (p.fuelTarget > MAX_FUEL_TARGET || p.fuelCapPerPeriod > MAX_FUEL_CAP) revert FuelOutOfRange();
        if (p.icon >= ICON_COUNT || p.hue >= HUE_COUNT) revert BadAppearance();
        if (payees.length > MAX_PAYEES) revert TooManyPayees();

        id = ++pocketCount;
        Pocket storage pk = _store(id, p);
        _emitCreated(id, p);
        _addPayees(id, pk, payees);

        if (p.deposit > 0) {
            uint128 received = _pull(p.deposit);
            pk.balance += received;
            emit Funded(id, msg.sender, received, _touch(pk));
        }

        _refuel(id, pk);
    }

    /// @notice Adds USDC to a pocket. Anyone may fund any pocket.
    /// @dev The sponsor can take back anything added, including other people's contributions, once any lock ends.
    ///      Rolls the period, then tops up the spender's fee credit with the same rules and the same per-period cap
    ///      as spend and request. The roll is what keeps a used cap from blocking later top-ups.
    /// @param id The pocket.
    /// @param amount USDC base units to pull with transferFrom (needs an exact-amount approval first).
    function fund(uint256 id, uint128 amount) external nonReentrant {
        Pocket storage pk = _pocket(id);
        if (amount == 0) revert InvalidAmount();
        uint128 received = _pull(amount);
        pk.balance += received;
        emit Funded(id, msg.sender, received, _touch(pk));
        _roll(pk);
        _refuel(id, pk);
    }

    /// @notice Pays `to` from the pocket within the rules. Only the pocket's spender can call it.
    /// @dev Rolls the period first. The amount must fit what is left this period and the balance, and `to` must be
    ///      an approved payee when the pocket is payee-only. Tops up the spender's fee credit afterwards.
    /// @param id The pocket.
    /// @param to Recipient; never the zero address or this contract.
    /// @param amount USDC base units.
    /// @param memo Optional public note, at most 64 bytes.
    function spend(uint256 id, address to, uint128 amount, string calldata memo) external nonReentrant {
        Pocket storage pk = _pocket(id);
        if (msg.sender != pk.spender) revert NotSpender();
        _checkRecipient(to);
        if (amount == 0) revert InvalidAmount();
        if (bytes(memo).length > MAX_MEMO_BYTES) revert MemoTooLong();
        if (pk.payeeOnly && !_isPayee[id][to]) revert PayeeNotApproved();
        _roll(pk);
        uint128 left = _left(pk.limitPerPeriod, pk.spentInPeriod);
        if (amount > left) revert OverLimit(_min(left, pk.balance));
        if (amount > pk.balance) revert InsufficientBalance(pk.balance);

        pk.spentInPeriod += amount;
        pk.balance -= amount;
        emit Spent(id, to, amount, memo, _touch(pk));
        usdc.safeTransfer(to, amount);

        _refuel(id, pk);
    }

    /// @notice Asks the sponsor to approve a payment above the rules. Only the pocket's spender can call it.
    /// @dev Any valid recipient is allowed, even on a payee-only pocket: the sponsor's approval is the check.
    ///      At most 20 requests can wait at once. Tops up the spender's fee credit afterwards.
    /// @param id The pocket.
    /// @param to Recipient; never the zero address or this contract.
    /// @param amount USDC base units.
    /// @param memo Optional public note, at most 64 bytes.
    /// @return requestId The new request's id.
    function request(uint256 id, address to, uint128 amount, string calldata memo)
        external
        nonReentrant
        returns (uint256 requestId)
    {
        Pocket storage pk = _pocket(id);
        if (msg.sender != pk.spender) revert NotSpender();
        _checkRecipient(to);
        if (amount == 0) revert InvalidAmount();
        if (bytes(memo).length > MAX_MEMO_BYTES) revert MemoTooLong();
        if (_pendingCount[id] >= MAX_PENDING) revert TooManyPending();
        _roll(pk);

        requestId = ++requestCount;
        _requests[requestId] = Request({pocketId: id, to: to, amount: amount, status: Status.Pending, memo: memo});
        _requestsByPocket[id].push(requestId);
        _pendingCount[id] += 1;
        emit Requested(id, requestId, to, amount, memo, _touch(pk));

        _refuel(id, pk);
    }

    /// @notice Approves a pending request and pays its recipient in the same call. Only the sponsor can call it.
    /// @dev Approved amounts do not count against the period limit.
    /// @param requestId The request.
    function approveRequest(uint256 requestId) external nonReentrant {
        (Request storage r, Pocket storage pk) = _pendingRequestOfSponsor(requestId);
        uint128 amount = r.amount;
        if (amount > pk.balance) revert InsufficientBalance(pk.balance);

        r.status = Status.Approved;
        _pendingCount[r.pocketId] -= 1;
        pk.balance -= amount;
        emit Approved(r.pocketId, requestId, _touch(pk));
        usdc.safeTransfer(r.to, amount);
    }

    /// @notice Declines a pending request. The money stays in the pocket. Only the sponsor can call it.
    /// @param requestId The request.
    function declineRequest(uint256 requestId) external nonReentrant {
        (Request storage r, Pocket storage pk) = _pendingRequestOfSponsor(requestId);
        r.status = Status.Declined;
        _pendingCount[r.pocketId] -= 1;
        emit Declined(r.pocketId, requestId, _touch(pk));
    }

    /// @notice Takes unspent money back from a pocket. Only the sponsor can call it, and not before the lock date.
    /// @param id The pocket.
    /// @param amount USDC base units.
    /// @param to Recipient; never the zero address or this contract.
    function withdraw(uint256 id, uint128 amount, address to) external nonReentrant {
        Pocket storage pk = _pocket(id);
        if (msg.sender != pk.sponsor) revert NotSponsor();
        _checkRecipient(to);
        if (amount == 0) revert InvalidAmount();
        if (block.timestamp < pk.lockUntil) revert Locked(pk.lockUntil);
        if (amount > pk.balance) revert InsufficientBalance(pk.balance);

        pk.balance -= amount;
        emit Withdrawn(id, to, amount, _touch(pk));
        usdc.safeTransfer(to, amount);
    }

    /// @notice Moves the commitment lock later. A lock can never be shortened. Only the sponsor can call it.
    /// @param id The pocket.
    /// @param newLock Unix time; later than the current lock, in the future, and at most 730 days ahead.
    function extendLock(uint256 id, uint64 newLock) external nonReentrant {
        Pocket storage pk = _pocket(id);
        if (msg.sender != pk.sponsor) revert NotSponsor();
        if (newLock <= pk.lockUntil) revert LockNotExtended();
        if (newLock <= block.timestamp || newLock > block.timestamp + MAX_LOCK_AHEAD) revert BadLock();

        pk.lockUntil = newLock;
        emit LockExtended(id, newLock, _touch(pk));
    }

    /// @notice Adds or removes an approved payee. Only the sponsor can call it. At most 10 payees can be active.
    /// @dev Setting a payee to the state it already has changes nothing and emits nothing.
    /// @param id The pocket.
    /// @param payee The address to approve or remove; never the zero address or this contract.
    /// @param allowed True to approve, false to remove.
    function setPayee(uint256 id, address payee, bool allowed) external nonReentrant {
        Pocket storage pk = _pocket(id);
        if (msg.sender != pk.sponsor) revert NotSponsor();
        _checkRecipient(payee);
        if (_isPayee[id][payee] == allowed) return;

        address[] storage list = _payeeList[id];
        if (allowed) {
            if (list.length >= MAX_PAYEES) revert TooManyPayees();
            list.push(payee);
        } else {
            uint256 last = list.length - 1;
            for (uint256 i; i <= last; ++i) {
                if (list[i] == payee) {
                    list[i] = list[last];
                    list.pop();
                    break;
                }
            }
        }
        _isPayee[id][payee] = allowed;
        emit PayeeSet(id, payee, allowed, _touch(pk));
    }

    /// @notice Changes the limit per period. Only the sponsor can call it. Spending so far this period still counts.
    /// @dev Rolls the period first, so a limit set after a period has ended starts a fresh period. Lowering the limit
    ///      below what was already spent this period leaves nothing more to spend until the next period.
    /// @param id The pocket.
    /// @param limit USDC base units per period; 0 makes every payment a request.
    function setLimit(uint256 id, uint128 limit) external nonReentrant {
        Pocket storage pk = _pocket(id);
        if (msg.sender != pk.sponsor) revert NotSponsor();
        _roll(pk);
        pk.limitPerPeriod = limit;
        emit LimitChanged(id, limit, _touch(pk));
    }

    /// @notice Withdraws a pending request. Only the pocket's spender can call it. The money stays in the pocket.
    /// @param requestId The request.
    function cancelRequest(uint256 requestId) external nonReentrant {
        Request storage r = _requests[requestId];
        if (r.status == Status.None) revert NotPending();
        Pocket storage pk = _pockets[r.pocketId];
        if (msg.sender != pk.spender) revert NotSpender();
        if (r.status != Status.Pending) revert NotPending();

        r.status = Status.Cancelled;
        _pendingCount[r.pocketId] -= 1;
        emit Cancelled(r.pocketId, requestId, _touch(pk));
    }

    // ------------------------------------------------------------------ reads

    /// @notice Returns a pocket as stored. `spentInPeriod` and `fuelUsedInPeriod` may belong to a period that has
    ///         ended; use `available` for what can be spent now.
    /// @param id The pocket.
    function getPocket(uint256 id) external view returns (Pocket memory) {
        return _pocket(id);
    }

    /// @notice What the spender can pay right now without asking: the smaller of what is left this period (after a
    ///         virtual period roll) and the balance. Returns 0 for request-only pockets.
    /// @param id The pocket.
    function available(uint256 id) external view returns (uint128) {
        Pocket storage pk = _pocket(id);
        uint128 spent = block.timestamp >= uint256(pk.periodStart) + pk.periodLength ? 0 : pk.spentInPeriod;
        return _min(_left(pk.limitPerPeriod, spent), pk.balance);
    }

    /// @notice Approved payees of a pocket.
    /// @param id The pocket.
    function payeesOf(uint256 id) external view returns (address[] memory) {
        _pocket(id);
        return _payeeList[id];
    }

    /// @notice Whether `payee` is an approved payee of the pocket.
    /// @param id The pocket.
    /// @param payee The address to check.
    function isPayee(uint256 id, address payee) external view returns (bool) {
        return _isPayee[id][payee];
    }

    /// @notice Ids of the pockets `sponsor` created, oldest first.
    /// @param sponsor The creator's address.
    function pocketsOfSponsor(address sponsor) external view returns (uint256[] memory) {
        return _pocketsBySponsor[sponsor];
    }

    /// @notice Ids of the pockets `spender` can pay from, oldest first.
    /// @param spender The family member's address.
    function pocketsOfSpender(address spender) external view returns (uint256[] memory) {
        return _pocketsBySpender[spender];
    }

    /// @notice Ids of every request made on a pocket, oldest first.
    /// @param id The pocket.
    function requestsOf(uint256 id) external view returns (uint256[] memory) {
        _pocket(id);
        return _requestsByPocket[id];
    }

    /// @notice Returns a request as stored. Reverts for an id that was never used.
    /// @param requestId The request.
    function getRequest(uint256 requestId) external view returns (Request memory) {
        Request storage r = _requests[requestId];
        if (r.status == Status.None) revert NotPending();
        return r;
    }

    /// @notice Number of requests waiting for the sponsor on a pocket.
    /// @param id The pocket.
    function pendingCount(uint256 id) external view returns (uint256) {
        return _pendingCount[id];
    }

    // ------------------------------------------------------------------ internals

    /// @dev Stores a new pocket with the caller as sponsor and indexes it by sponsor and spender.
    function _store(uint256 id, CreateParams calldata p) private returns (Pocket storage pk) {
        pk = _pockets[id];
        pk.sponsor = msg.sender;
        pk.payeeOnly = p.payeeOnly;
        pk.icon = p.icon;
        pk.hue = p.hue;
        pk.spender = p.spender;
        pk.limitPerPeriod = p.limitPerPeriod;
        pk.fuelTarget = p.fuelTarget;
        pk.fuelCapPerPeriod = p.fuelCapPerPeriod;
        pk.periodLength = p.periodLength;
        // casting to 'uint64' is safe because Unix time fits in 64 bits for billions of years
        // forge-lint: disable-next-line(unsafe-typecast)
        pk.periodStart = uint64(block.timestamp);
        pk.lockUntil = p.lockUntil;
        // casting to 'uint64' is safe because block numbers fit in 64 bits
        // forge-lint: disable-next-line(unsafe-typecast)
        pk.lastEventBlock = uint64(block.number);
        pk.label = p.label;
        _pocketsBySponsor[msg.sender].push(id);
        _pocketsBySpender[p.spender].push(id);
    }

    function _emitCreated(uint256 id, CreateParams calldata p) private {
        emit PocketCreated(
            id,
            msg.sender,
            p.spender,
            p.label,
            p.limitPerPeriod,
            p.periodLength,
            p.lockUntil,
            p.payeeOnly,
            p.icon,
            p.hue
        );
    }

    /// @dev Approves each payee once; duplicates are skipped.
    function _addPayees(uint256 id, Pocket storage pk, address[] calldata payees) private {
        for (uint256 i; i < payees.length; ++i) {
            address payee = payees[i];
            _checkRecipient(payee);
            if (_isPayee[id][payee]) continue;
            _isPayee[id][payee] = true;
            _payeeList[id].push(payee);
            emit PayeeSet(id, payee, true, _touch(pk));
        }
    }

    function _pocket(uint256 id) private view returns (Pocket storage pk) {
        pk = _pockets[id];
        if (pk.sponsor == address(0)) revert UnknownPocket();
    }

    function _pendingRequestOfSponsor(uint256 requestId) private view returns (Request storage r, Pocket storage pk) {
        r = _requests[requestId];
        if (r.status == Status.None) revert NotPending();
        pk = _pockets[r.pocketId];
        if (msg.sender != pk.sponsor) revert NotSponsor();
        if (r.status != Status.Pending) revert NotPending();
    }

    /// @dev A valid recipient is never the zero address and never this contract.
    function _checkRecipient(address to) private view {
        // forge-lint: disable-next-line(require-revert-in-loop)
        if (to == address(0) || to == address(this)) revert InvalidAddress();
    }

    /// @dev Returns the block of the pocket's previous event and records the current block as the latest.
    function _touch(Pocket storage pk) private returns (uint64 prev) {
        prev = pk.lastEventBlock;
        // casting to 'uint64' is safe because block numbers fit in 64 bits
        // forge-lint: disable-next-line(unsafe-typecast)
        pk.lastEventBlock = uint64(block.number);
    }

    /// @dev Moves `periodStart` forward by whole periods and resets the per-period counters once a period has ended.
    function _roll(Pocket storage pk) private {
        uint256 start = pk.periodStart;
        uint256 length = pk.periodLength;
        if (block.timestamp < start + length) return;
        // Dividing first is the point: it floors the elapsed time to whole periods, so the new start stays on the
        // pocket's own period grid. The truncation is the intended rounding, not a precision loss.
        // casting to 'uint64' is safe because the result is at most block.timestamp
        // slither-disable-start divide-before-multiply
        // forge-lint: disable-next-line(divide-before-multiply,unsafe-typecast)
        pk.periodStart = uint64(start + ((block.timestamp - start) / length) * length);
        // slither-disable-end divide-before-multiply
        pk.spentInPeriod = 0;
        pk.fuelUsedInPeriod = 0;
    }

    /// @dev Tops the spender up to `fuelTarget` when their USDC balance is below half of it, within the per-period
    ///      cap and the pocket balance. Top-ups never count against the spending limit.
    function _refuel(uint256 id, Pocket storage pk) private {
        uint128 target = pk.fuelTarget;
        if (target == 0) return;
        address spender = pk.spender;
        uint256 held = usdc.balanceOf(spender);
        if (held >= target / 2) return;

        // casting to 'uint128' is safe because held < target / 2 and target is a uint128
        // forge-lint: disable-next-line(unsafe-typecast)
        uint128 shortfall = target - uint128(held);
        uint128 amount = _min(_min(shortfall, _left(pk.fuelCapPerPeriod, pk.fuelUsedInPeriod)), pk.balance);
        // Zero only means there is nothing to top up (cap used or pocket empty); it is never a security check.
        // slither-disable-next-line incorrect-equality
        if (amount == 0) return;

        pk.fuelUsedInPeriod += amount;
        pk.balance -= amount;
        emit Refuelled(id, spender, amount, _touch(pk));
        usdc.safeTransfer(spender, amount);
    }

    /// @dev Pulls `amount` from the caller and returns what actually arrived.
    function _pull(uint128 amount) private returns (uint128 received) {
        uint256 before = usdc.balanceOf(address(this));
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        received = SafeCast.toUint128(usdc.balanceOf(address(this)) - before);
        // Rejects a deposit that credited nothing. Extra USDC sent to the contract can only raise `received`,
        // so the strict equality cannot be used to block or inflate a deposit.
        // slither-disable-next-line incorrect-equality
        if (received == 0) revert InvalidAmount();
    }

    function _left(uint128 cap, uint128 used) private pure returns (uint128) {
        return cap > used ? cap - used : 0;
    }

    function _min(uint128 a, uint128 b) private pure returns (uint128) {
        return a < b ? a : b;
    }
}
