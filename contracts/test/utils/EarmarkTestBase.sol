// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {EarmarkPockets} from "../../src/EarmarkPockets.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

/// @notice Shared setup: a 6-decimal USDC, the Earmark contract and named people.
abstract contract EarmarkTestBase is Test {
    uint128 internal constant ONE = 1e6; // 1 USDC in base units
    uint64 internal constant START_TIME = 1_790_000_000;
    uint256 internal constant START_BLOCK = 1_000;

    MockUSDC internal usdc;
    EarmarkPockets internal pockets;

    address internal sponsor = makeAddr("sponsor");
    address internal spender = makeAddr("spender");
    address internal payee = makeAddr("payee");
    address internal cofunder = makeAddr("cofunder");
    address internal stranger = makeAddr("stranger");

    function setUp() public virtual {
        vm.warp(START_TIME);
        vm.roll(START_BLOCK);
        usdc = new MockUSDC();
        pockets = new EarmarkPockets(IERC20Metadata(address(usdc)));
        usdc.mint(sponsor, 1_000_000 * ONE);
        usdc.mint(cofunder, 1_000 * ONE);
    }

    /// @dev "Food": 20 USDC every 7 days, 0.05 fee credit (cap 0.10), 30 USDC deposit.
    function _food() internal view returns (EarmarkPockets.CreateParams memory p) {
        p = EarmarkPockets.CreateParams({
            spender: spender,
            label: "Food",
            limitPerPeriod: 20 * ONE,
            periodLength: 7 days,
            lockUntil: 0,
            payeeOnly: false,
            fuelTarget: 50_000,
            fuelCapPerPeriod: 100_000,
            deposit: 30 * ONE,
            icon: 1,
            hue: 0
        });
    }

    function _none() internal pure returns (address[] memory) {
        return new address[](0);
    }

    function _one(address a) internal pure returns (address[] memory list) {
        list = new address[](1);
        list[0] = a;
    }

    function _create(EarmarkPockets.CreateParams memory p, address[] memory payees) internal returns (uint256 id) {
        vm.startPrank(sponsor);
        usdc.approve(address(pockets), p.deposit);
        id = pockets.createPocket(p, payees);
        vm.stopPrank();
    }

    function _createFood() internal returns (uint256) {
        return _create(_food(), _none());
    }

    function _fund(address from, uint256 id, uint128 amount) internal {
        vm.startPrank(from);
        usdc.approve(address(pockets), amount);
        pockets.fund(id, amount);
        vm.stopPrank();
    }

    /// @dev Stands in for the network fees the spender pays: moves their USDC away.
    function _burnSpenderFees(uint256 amount) internal {
        vm.prank(spender);
        usdc.transfer(address(0xFEE), amount);
    }

    function _pocket(uint256 id) internal view returns (EarmarkPockets.Pocket memory) {
        return pockets.getPocket(id);
    }
}
