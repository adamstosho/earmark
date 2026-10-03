// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice 6-decimal stand-in for Arc's USDC ERC-20 interface. Standard anvil runs a plain EVM (PRD A10), so tests
///         use this and behaviour is confirmed on Arc testnet.
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure virtual override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @notice Takes 1% of every transfer, to prove deposits are credited by the balance actually received.
contract MockFeeUSDC is MockUSDC {
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = value / 100;
            super._update(from, address(0), fee);
            super._update(from, to, value - fee);
        } else {
            super._update(from, to, value);
        }
    }
}

/// @notice Moves nothing on transferFrom, to prove a deposit that credits nothing reverts.
contract MockNoopUSDC is MockUSDC {
    function transferFrom(address, address, uint256) public pure override returns (bool) {
        return true;
    }
}

/// @notice Blocks transfers to or from listed addresses, like USDC's compliance blocklist (PRD A6).
contract MockBlocklistUSDC is MockUSDC {
    mapping(address => bool) public blocked;

    error Blocklisted(address account);

    function setBlocked(address account, bool isBlocked) external {
        blocked[account] = isBlocked;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (blocked[from]) revert Blocklisted(from);
        if (blocked[to]) revert Blocklisted(to);
        super._update(from, to, value);
    }
}

/// @notice An 18-decimal token, to prove the constructor rejects anything but 6 decimals.
contract Mock18Token is ERC20 {
    constructor() ERC20("Eighteen", "E18") {}
}

interface IReenterTarget {
    function withdraw(uint256 id, uint128 amount, address to) external;
}

/// @notice Calls back into Earmark during a transfer, to prove every write is nonReentrant.
contract MockReentrantUSDC is MockUSDC {
    address public target;
    uint256 public pocketId;
    bool public armed;

    function arm(address target_, uint256 pocketId_) external {
        target = target_;
        pocketId = pocketId_;
        armed = true;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (armed && from == target) {
            armed = false;
            IReenterTarget(target).withdraw(pocketId, 1, address(this));
        }
        super._update(from, to, value);
    }
}
