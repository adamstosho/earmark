// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {EarmarkPockets} from "../../src/EarmarkPockets.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

/// @notice Drives random sequences of every Earmark write, by authorised and unauthorised callers, and records
///         ghost state the invariants check afterwards.
contract Handler is Test {
    uint128 internal constant ONE = 1e6;

    EarmarkPockets public immutable pockets;
    MockUSDC public immutable usdc;

    address[3] internal sponsors = [address(0xA11CE), address(0xB0B), address(0xCA7)];
    address[3] internal spenders = [address(0xD06), address(0xE11A), address(0xF1D0)];
    address internal constant PAYEE = address(0xBEEF);
    address internal constant STRANGER = address(0x5757);

    // ghost state
    uint256[] public pocketIds;
    uint256[] public requestIds;
    mapping(uint256 pocketId => uint64) public lastSeenLock;
    mapping(uint256 requestId => uint256) public transitions;
    uint256 public lockDecreases;
    uint256 public withdrawalsWhileLocked;
    uint256 public unauthorisedSuccesses;
    uint256 public requestLeftPendingTwice;
    /// Spends that left `spentInPeriod` above the limit in force at that moment.
    uint256 public spendsOverLimit;
    /// Funds whose fee-credit top-up differed from the same formula `fund` uses.
    uint256 public refuelMismatches;
    /// The period in which the sponsor lowered a pocket's limit below what was already spent (allowed by setLimit).
    mapping(uint256 pocketId => uint64) public loweredInPeriod;
    mapping(bytes32 => uint256) public calls;

    constructor(EarmarkPockets pockets_, MockUSDC usdc_) {
        pockets = pockets_;
        usdc = usdc_;
        for (uint256 i; i < 3; ++i) {
            usdc.mint(sponsors[i], 1_000_000 * ONE);
        }
    }

    // ------------------------------------------------------------------ helpers

    function pocketCount() external view returns (uint256) {
        return pocketIds.length;
    }

    function requestCountSeen() external view returns (uint256) {
        return requestIds.length;
    }

    function _pick(uint256 seed) internal view returns (uint256 id, EarmarkPockets.Pocket memory pk) {
        id = pocketIds[seed % pocketIds.length];
        pk = pockets.getPocket(id);
    }

    function _trackLocks() internal {
        for (uint256 i; i < pocketIds.length; ++i) {
            uint64 lock = pockets.getPocket(pocketIds[i]).lockUntil;
            if (lock < lastSeenLock[pocketIds[i]]) ++lockDecreases;
            lastSeenLock[pocketIds[i]] = lock;
        }
    }

    // ------------------------------------------------------------------ actions

    function createPocket(uint256 seed, uint128 limit, uint64 period, uint64 lockAhead, uint128 deposit, uint128 fuel)
        external
    {
        address sponsor = sponsors[seed % 3];
        EarmarkPockets.CreateParams memory p = EarmarkPockets.CreateParams({
            spender: spenders[(seed / 3) % 3],
            label: "Pocket",
            limitPerPeriod: uint128(bound(limit, 0, 100 * ONE)),
            periodLength: uint64(bound(period, 1 days, 31 days)),
            lockUntil: seed % 4 == 0 ? uint64(block.timestamp + bound(lockAhead, 1, 60 days)) : 0,
            payeeOnly: seed % 5 == 0,
            fuelTarget: uint128(bound(fuel, 0, 500_000)),
            fuelCapPerPeriod: uint128(bound(fuel / 3, 0, 1_000_000)),
            deposit: uint128(bound(deposit, 0, 500 * ONE)),
            icon: uint8(seed % 10),
            hue: uint8(seed % 6)
        });
        address[] memory payees = new address[](1);
        payees[0] = PAYEE;

        vm.startPrank(sponsor);
        usdc.approve(address(pockets), p.deposit);
        uint256 id = pockets.createPocket(p, payees);
        vm.stopPrank();
        pocketIds.push(id);
        lastSeenLock[id] = p.lockUntil;
        ++calls[keccak256("createPocket")];
        _trackLocks();
    }

    function fund(uint256 seed, uint128 amount) external {
        if (pocketIds.length == 0) return;
        (uint256 id, EarmarkPockets.Pocket memory pk) = _pick(seed);
        amount = uint128(bound(amount, 1, 200 * ONE));
        address from = sponsors[(seed / 7) % 3];
        uint256 beforeBal = usdc.balanceOf(pk.spender);
        uint128 expected = _expectedTopUp(pk, amount);
        vm.startPrank(from);
        usdc.approve(address(pockets), amount);
        try pockets.fund(id, amount) {
            uint256 afterBal = usdc.balanceOf(pk.spender);
            if (afterBal < beforeBal || afterBal - beforeBal != expected) ++refuelMismatches;
            ++calls[keccak256("fund")];
        } catch {}
        vm.stopPrank();
        _trackLocks();
    }

    /// @dev The top-up `fund` should send: roll the period virtually, then the same half-float formula as `_refuel`.
    ///      Mock USDC credits the full amount, so the pocket balance grows by `added` before the top-up.
    function _expectedTopUp(EarmarkPockets.Pocket memory pk, uint128 added) internal view returns (uint128) {
        if (uint256(pk.balance) + added > type(uint128).max) return 0;
        uint128 fuelUsed = pk.fuelUsedInPeriod;
        if (block.timestamp >= uint256(pk.periodStart) + pk.periodLength) fuelUsed = 0;
        uint128 target = pk.fuelTarget;
        if (target == 0) return 0;
        uint256 held = usdc.balanceOf(pk.spender);
        if (held >= target / 2) return 0;
        uint128 shortfall = target - uint128(held);
        uint128 capLeft = pk.fuelCapPerPeriod > fuelUsed ? pk.fuelCapPerPeriod - fuelUsed : 0;
        uint128 balanceAfter = pk.balance + added;
        uint128 capped = shortfall < capLeft ? shortfall : capLeft;
        return capped < balanceAfter ? capped : balanceAfter;
    }

    function spend(uint256 seed, uint128 amount, bool toPayee) external {
        if (pocketIds.length == 0) return;
        (uint256 id, EarmarkPockets.Pocket memory pk) = _pick(seed);
        // Up to twice what is available, so about half the attempts are within the rules.
        uint256 ceiling = 2 * uint256(pockets.available(id));
        amount = uint128(bound(amount, 1, ceiling > 1 ? ceiling : 1));
        vm.prank(pk.spender);
        try pockets.spend(id, toPayee ? PAYEE : STRANGER, amount, "") {
            ++calls[keccak256("spend")];
            EarmarkPockets.Pocket memory after_ = pockets.getPocket(id);
            if (after_.spentInPeriod > after_.limitPerPeriod) ++spendsOverLimit;
        } catch {}
        _trackLocks();
    }

    function request(uint256 seed, uint128 amount) external {
        if (pocketIds.length == 0) return;
        (uint256 id, EarmarkPockets.Pocket memory pk) = _pick(seed);
        amount = uint128(bound(amount, 1, 300 * ONE));
        vm.prank(pk.spender);
        try pockets.request(id, STRANGER, amount, "") returns (uint256 rid) {
            requestIds.push(rid);
            ++calls[keccak256("request")];
        } catch {}
        _trackLocks();
    }

    function decide(uint256 seed, bool approve) external {
        if (requestIds.length == 0) return;
        uint256 rid = requestIds[seed % requestIds.length];
        EarmarkPockets.Request memory r = pockets.getRequest(rid);
        address sponsor = pockets.getPocket(r.pocketId).sponsor;
        bool wasPending = r.status == EarmarkPockets.Status.Pending;
        vm.prank(sponsor);
        if (approve) {
            try pockets.approveRequest(rid) {
                _transition(rid, wasPending);
                ++calls[keccak256("approveRequest")];
            } catch {}
        } else {
            try pockets.declineRequest(rid) {
                _transition(rid, wasPending);
                ++calls[keccak256("declineRequest")];
            } catch {}
        }
        _trackLocks();
    }

    function _transition(uint256 rid, bool wasPending) internal {
        ++transitions[rid];
        if (!wasPending || transitions[rid] > 1) ++requestLeftPendingTwice;
    }

    function withdraw(uint256 seed, uint128 amount) external {
        if (pocketIds.length == 0) return;
        (uint256 id, EarmarkPockets.Pocket memory pk) = _pick(seed);
        amount = uint128(bound(amount, 1, pk.balance > 1 ? pk.balance : 1));
        bool lockedNow = block.timestamp < pk.lockUntil;
        vm.prank(pk.sponsor);
        try pockets.withdraw(id, amount, pk.sponsor) {
            if (lockedNow) ++withdrawalsWhileLocked;
            ++calls[keccak256("withdraw")];
        } catch {}
        _trackLocks();
    }

    function extendLock(uint256 seed, uint64 ahead) external {
        if (pocketIds.length == 0) return;
        (uint256 id, EarmarkPockets.Pocket memory pk) = _pick(seed);
        uint64 newLock = uint64(bound(ahead, 0, 800 days)) + uint64(block.timestamp);
        vm.prank(pk.sponsor);
        try pockets.extendLock(id, newLock) {
            ++calls[keccak256("extendLock")];
        } catch {}
        _trackLocks();
    }

    function setPayee(uint256 seed, uint8 which, bool allowed) external {
        if (pocketIds.length == 0) return;
        (uint256 id, EarmarkPockets.Pocket memory pk) = _pick(seed);
        address payee = which % 3 == 0 ? PAYEE : which % 3 == 1 ? STRANGER : address(uint160(0x7000 + (which % 12)));
        vm.prank(pk.sponsor);
        try pockets.setPayee(id, payee, allowed) {
            ++calls[keccak256("setPayee")];
        } catch {}
        _trackLocks();
    }

    function setLimit(uint256 seed, uint128 limit) external {
        if (pocketIds.length == 0) return;
        (uint256 id, EarmarkPockets.Pocket memory pk) = _pick(seed);
        limit = uint128(bound(limit, 0, 100 * ONE));
        vm.prank(pk.sponsor);
        try pockets.setLimit(id, limit) {
            ++calls[keccak256("setLimit")];
            EarmarkPockets.Pocket memory after_ = pockets.getPocket(id);
            if (after_.spentInPeriod > after_.limitPerPeriod) loweredInPeriod[id] = after_.periodStart;
        } catch {}
        _trackLocks();
    }

    function cancel(uint256 seed) external {
        if (requestIds.length == 0) return;
        uint256 rid = requestIds[seed % requestIds.length];
        EarmarkPockets.Request memory r = pockets.getRequest(rid);
        address spender = pockets.getPocket(r.pocketId).spender;
        bool wasPending = r.status == EarmarkPockets.Status.Pending;
        vm.prank(spender);
        try pockets.cancelRequest(rid) {
            _transition(rid, wasPending);
            ++calls[keccak256("cancelRequest")];
        } catch {}
        _trackLocks();
    }

    /// @dev Someone other than the spender tries to spend, request or cancel, and someone other than the sponsor tries
    ///      to decide, withdraw, move the lock or change payees or the limit. None of these may ever succeed.
    function intrude(uint256 seed, uint8 action) external {
        if (pocketIds.length == 0) return;
        (uint256 id, EarmarkPockets.Pocket memory pk) = _pick(seed);
        address intruder = seed % 2 == 0 ? STRANGER : (action % 2 == 0 ? pk.sponsor : pk.spender);
        action = action % 9;
        bool ok;
        vm.startPrank(intruder);
        if (action == 0 && intruder != pk.spender) {
            try pockets.spend(id, PAYEE, 1, "") {
                ok = true;
            } catch {}
        } else if (action == 1 && intruder != pk.spender) {
            try pockets.request(id, PAYEE, 1, "") {
                ok = true;
            } catch {}
        } else if (action == 2 && intruder != pk.sponsor && requestIds.length > 0) {
            try pockets.approveRequest(requestIds[seed % requestIds.length]) {
                ok = true;
            } catch {}
        } else if (action == 3 && intruder != pk.sponsor && requestIds.length > 0) {
            try pockets.declineRequest(requestIds[seed % requestIds.length]) {
                ok = true;
            } catch {}
        } else if (action == 4 && intruder != pk.sponsor) {
            try pockets.withdraw(id, 1, intruder) {
                ok = true;
            } catch {}
        } else if (action == 5 && intruder != pk.sponsor) {
            try pockets.extendLock(id, uint64(block.timestamp + 1 days)) {
                ok = true;
            } catch {}
        } else if (action == 6 && intruder != pk.sponsor) {
            try pockets.setPayee(id, intruder, true) {
                ok = true;
            } catch {}
        } else if (action == 7 && intruder != pk.sponsor) {
            try pockets.setLimit(id, 100 * ONE) {
                ok = true;
            } catch {}
        } else if (action == 8 && requestIds.length > 0) {
            try pockets.cancelRequest(requestIds[seed % requestIds.length]) {
                ok = true;
            } catch {}
        }
        vm.stopPrank();
        // The spender of the request's own pocket may cancel it: that is authorised.
        if (ok && action == 8) {
            EarmarkPockets.Request memory r = pockets.getRequest(requestIds[seed % requestIds.length]);
            if (pockets.getPocket(r.pocketId).spender == intruder) {
                _transition(requestIds[seed % requestIds.length], true);
                ok = false;
            }
        }
        // A request id picked above may belong to another pocket whose sponsor is the intruder: that is authorised.
        if (ok && (action == 2 || action == 3)) {
            EarmarkPockets.Request memory r = pockets.getRequest(requestIds[seed % requestIds.length]);
            if (pockets.getPocket(r.pocketId).sponsor == intruder) {
                _transition(requestIds[seed % requestIds.length], true);
                ok = false;
            }
        }
        if (ok) ++unauthorisedSuccesses;
        _trackLocks();
    }

    /// @dev The spender pays network fees, which lowers their USDC balance and triggers top-ups later.
    function payNetworkFees(uint256 seed, uint128 amount) external {
        address who = spenders[seed % 3];
        uint256 held = usdc.balanceOf(who);
        if (held == 0) return;
        vm.prank(who);
        usdc.transfer(address(0xFEE), bound(amount, 1, held));
    }

    function warp(uint32 secondsAhead) external {
        vm.warp(block.timestamp + bound(secondsAhead, 1, 10 days));
        vm.roll(block.number + 1);
        _trackLocks();
    }
}
