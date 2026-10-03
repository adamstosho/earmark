// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Vm} from "forge-std/Vm.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EarmarkPockets} from "../src/EarmarkPockets.sol";
import {EarmarkTestBase} from "./utils/EarmarkTestBase.sol";
import {
    MockUSDC,
    MockFeeUSDC,
    MockNoopUSDC,
    MockBlocklistUSDC,
    Mock18Token,
    MockReentrantUSDC
} from "./mocks/MockUSDC.sol";

contract ConstructorTest is EarmarkTestBase {
    function test_StoresUsdc() public view {
        assertEq(address(pockets.usdc()), address(usdc));
        assertEq(pockets.pocketCount(), 0);
        assertEq(pockets.requestCount(), 0);
    }

    function test_RevertsUnlessSixDecimals() public {
        Mock18Token token = new Mock18Token();
        vm.expectRevert(EarmarkPockets.BadToken.selector);
        new EarmarkPockets(IERC20Metadata(address(token)));
    }
}

contract CreateTest is EarmarkTestBase {
    function test_StoresPocket() public {
        EarmarkPockets.CreateParams memory p = _food();
        p.lockUntil = START_TIME + 30 days;
        p.payeeOnly = true;
        p.icon = 9;
        p.hue = 5;
        uint256 id = _create(p, _one(payee));

        assertEq(id, 1);
        assertEq(pockets.pocketCount(), 1);
        EarmarkPockets.Pocket memory pk = _pocket(id);
        assertEq(pk.sponsor, sponsor);
        assertEq(pk.spender, spender);
        assertEq(pk.label, "Food");
        assertEq(pk.limitPerPeriod, 20 * ONE);
        assertEq(pk.spentInPeriod, 0);
        assertEq(pk.periodLength, 7 days);
        assertEq(pk.periodStart, START_TIME);
        assertEq(pk.lockUntil, START_TIME + 30 days);
        assertEq(pk.lastEventBlock, START_BLOCK);
        assertTrue(pk.payeeOnly);
        assertEq(pk.icon, 9);
        assertEq(pk.hue, 5);
        assertEq(pk.fuelTarget, 50_000);
        assertEq(pk.fuelCapPerPeriod, 100_000);
    }

    function test_IndexesBySponsorAndSpender() public {
        uint256 a = _createFood();
        uint256 b = _createFood();
        uint256[] memory bySponsor = pockets.pocketsOfSponsor(sponsor);
        uint256[] memory bySpender = pockets.pocketsOfSpender(spender);
        assertEq(bySponsor.length, 2);
        assertEq(bySponsor[0], a);
        assertEq(bySponsor[1], b);
        assertEq(bySpender.length, 2);
        assertEq(pockets.pocketsOfSponsor(stranger).length, 0);
    }

    function test_EmitsEventsInOrder() public {
        EarmarkPockets.CreateParams memory p = _food();
        vm.startPrank(sponsor);
        usdc.approve(address(pockets), p.deposit);

        vm.expectEmit(address(pockets));
        emit EarmarkPockets.PocketCreated(1, sponsor, spender, "Food", 20 * ONE, 7 days, 0, false, 1, 0);
        vm.expectEmit(address(pockets));
        emit EarmarkPockets.PayeeSet(1, payee, true, uint64(START_BLOCK));
        vm.expectEmit(address(pockets));
        emit EarmarkPockets.Funded(1, sponsor, 30 * ONE, uint64(START_BLOCK));
        vm.expectEmit(address(pockets));
        emit EarmarkPockets.Refuelled(1, spender, 50_000, uint64(START_BLOCK));
        pockets.createPocket(p, _one(payee));
        vm.stopPrank();
    }

    function test_FirstTopUpFromPocket() public {
        uint256 id = _createFood();
        assertEq(usdc.balanceOf(spender), 50_000);
        EarmarkPockets.Pocket memory pk = _pocket(id);
        assertEq(pk.balance, 30 * ONE - 50_000);
        assertEq(pk.fuelUsedInPeriod, 50_000);
        assertEq(pk.spentInPeriod, 0, "top-up is not spending");
        assertEq(usdc.balanceOf(address(pockets)), pk.balance);
    }

    function test_NoTopUpWhenSpenderHasEnough() public {
        usdc.mint(spender, 25_000); // exactly half the float: not below half
        uint256 id = _createFood();
        assertEq(usdc.balanceOf(spender), 25_000);
        assertEq(_pocket(id).fuelUsedInPeriod, 0);
    }

    function test_ZeroDepositEmitsNoFundedAndNoTopUp() public {
        EarmarkPockets.CreateParams memory p = _food();
        p.deposit = 0;
        vm.recordLogs();
        uint256 id = _create(p, _none());
        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 fromEarmark;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != address(pockets)) continue;
            ++fromEarmark;
            assertEq(logs[i].topics[0], EarmarkPockets.PocketCreated.selector, "only PocketCreated");
        }
        assertEq(fromEarmark, 1);
        assertEq(_pocket(id).balance, 0);
        assertEq(usdc.balanceOf(spender), 0);
    }

    function test_StoresPayeesOnceEach() public {
        address second = makeAddr("second");
        address[] memory list = new address[](3);
        list[0] = payee;
        list[1] = second;
        list[2] = payee;
        uint256 id = _create(_food(), list);
        address[] memory stored = pockets.payeesOf(id);
        assertEq(stored.length, 2);
        assertEq(stored[0], payee);
        assertEq(stored[1], second);
        assertTrue(pockets.isPayee(id, payee));
        assertTrue(pockets.isPayee(id, second));
        assertFalse(pockets.isPayee(id, stranger));
    }

    function test_AcceptsTenPayees() public {
        address[] memory list = new address[](10);
        for (uint256 i; i < 10; ++i) {
            list[i] = address(uint160(0x1000 + i));
        }
        uint256 id = _create(_food(), list);
        assertEq(pockets.payeesOf(id).length, 10);
    }

    function test_CreditsBalanceActuallyReceived() public {
        MockFeeUSDC feeToken = new MockFeeUSDC();
        EarmarkPockets feePockets = new EarmarkPockets(IERC20Metadata(address(feeToken)));
        feeToken.mint(sponsor, 100 * ONE);
        EarmarkPockets.CreateParams memory p = _food();
        p.fuelTarget = 0;
        vm.startPrank(sponsor);
        feeToken.approve(address(feePockets), p.deposit);
        uint256 id = feePockets.createPocket(p, _none());
        vm.stopPrank();
        assertEq(feePockets.getPocket(id).balance, 30 * ONE - 30 * ONE / 100);
        assertEq(feeToken.balanceOf(address(feePockets)), feePockets.getPocket(id).balance);
    }

    function test_RevertsWhenDepositCreditsNothing() public {
        MockNoopUSDC noop = new MockNoopUSDC();
        EarmarkPockets noopPockets = new EarmarkPockets(IERC20Metadata(address(noop)));
        EarmarkPockets.CreateParams memory p = _food();
        vm.prank(sponsor);
        vm.expectRevert(EarmarkPockets.InvalidAmount.selector);
        noopPockets.createPocket(p, _none());
    }

    function test_AcceptsMultiByteLabelUpTo32Bytes() public {
        EarmarkPockets.CreateParams memory p = _food();
        p.label = unicode"Owó ilé-ìwé"; // 11 characters, 15 bytes
        assertEq(bytes(p.label).length, 15);
        uint256 id = _create(p, _none());
        assertEq(_pocket(id).label, unicode"Owó ilé-ìwé");

        p.label = "12345678901234567890123456789012"; // 32 bytes
        _create(p, _none());
    }

    function test_AcceptsBoundaryValues() public {
        EarmarkPockets.CreateParams memory p = _food();
        p.periodLength = 1 days;
        p.fuelTarget = 500_000;
        p.fuelCapPerPeriod = 1_000_000;
        p.lockUntil = START_TIME + 730 days;
        _create(p, _none());
        p.periodLength = 31 days;
        p.lockUntil = START_TIME + 1;
        _create(p, _none());
        p.limitPerPeriod = 0; // request-only
        _create(p, _none());
    }

    function _expectCreateRevert(EarmarkPockets.CreateParams memory p, address[] memory payees, bytes4 selector)
        internal
    {
        vm.startPrank(sponsor);
        usdc.approve(address(pockets), p.deposit);
        vm.expectRevert(selector);
        pockets.createPocket(p, payees);
        vm.stopPrank();
    }

    function test_RevertsOnBadSpender() public {
        EarmarkPockets.CreateParams memory p = _food();
        p.spender = address(0);
        _expectCreateRevert(p, _none(), EarmarkPockets.InvalidAddress.selector);
        p.spender = address(pockets);
        _expectCreateRevert(p, _none(), EarmarkPockets.InvalidAddress.selector);
    }

    function test_RevertsOnBadLabel() public {
        EarmarkPockets.CreateParams memory p = _food();
        p.label = "";
        _expectCreateRevert(p, _none(), EarmarkPockets.BadLabel.selector);
        p.label = "123456789012345678901234567890123"; // 33 bytes
        _expectCreateRevert(p, _none(), EarmarkPockets.BadLabel.selector);
        p.label = unicode"ẹẹẹẹẹẹẹẹẹẹẹ"; // 11 characters, 33 bytes
        _expectCreateRevert(p, _none(), EarmarkPockets.BadLabel.selector);
    }

    function test_RevertsOnBadPeriod() public {
        EarmarkPockets.CreateParams memory p = _food();
        p.periodLength = 1 days - 1;
        _expectCreateRevert(p, _none(), EarmarkPockets.BadPeriod.selector);
        p.periodLength = 31 days + 1;
        _expectCreateRevert(p, _none(), EarmarkPockets.BadPeriod.selector);
        p.periodLength = 0;
        _expectCreateRevert(p, _none(), EarmarkPockets.BadPeriod.selector);
    }

    function test_RevertsOnBadLock() public {
        EarmarkPockets.CreateParams memory p = _food();
        p.lockUntil = START_TIME; // now is not the future
        _expectCreateRevert(p, _none(), EarmarkPockets.BadLock.selector);
        p.lockUntil = START_TIME - 1;
        _expectCreateRevert(p, _none(), EarmarkPockets.BadLock.selector);
        p.lockUntil = START_TIME + 730 days + 1;
        _expectCreateRevert(p, _none(), EarmarkPockets.BadLock.selector);
    }

    function test_RevertsOnFuelOutOfRange() public {
        EarmarkPockets.CreateParams memory p = _food();
        p.fuelTarget = 500_001;
        _expectCreateRevert(p, _none(), EarmarkPockets.FuelOutOfRange.selector);
        p.fuelTarget = 50_000;
        p.fuelCapPerPeriod = 1_000_001;
        _expectCreateRevert(p, _none(), EarmarkPockets.FuelOutOfRange.selector);
    }

    function test_RevertsOnBadAppearance() public {
        EarmarkPockets.CreateParams memory p = _food();
        p.icon = 10;
        _expectCreateRevert(p, _none(), EarmarkPockets.BadAppearance.selector);
        p.icon = 0;
        p.hue = 6;
        _expectCreateRevert(p, _none(), EarmarkPockets.BadAppearance.selector);
    }

    function test_RevertsOnTooManyPayees() public {
        address[] memory list = new address[](11);
        for (uint256 i; i < 11; ++i) {
            list[i] = address(uint160(0x1000 + i));
        }
        _expectCreateRevert(_food(), list, EarmarkPockets.TooManyPayees.selector);
    }

    function test_RevertsOnBadPayee() public {
        _expectCreateRevert(_food(), _one(address(0)), EarmarkPockets.InvalidAddress.selector);
        _expectCreateRevert(_food(), _one(address(pockets)), EarmarkPockets.InvalidAddress.selector);
    }

    function test_RevertsWithoutApproval() public {
        vm.prank(sponsor);
        vm.expectRevert();
        pockets.createPocket(_food(), _none());
    }
}

contract FundTest is EarmarkTestBase {
    uint256 internal id;

    function setUp() public override {
        super.setUp();
        id = _createFood();
    }

    function test_AnyoneCanFund() public {
        uint128 before = _pocket(id).balance;
        vm.roll(START_BLOCK + 5);
        vm.startPrank(cofunder);
        usdc.approve(address(pockets), 5 * ONE);
        vm.expectEmit(address(pockets));
        emit EarmarkPockets.Funded(id, cofunder, 5 * ONE, uint64(START_BLOCK));
        pockets.fund(id, 5 * ONE);
        vm.stopPrank();
        assertEq(_pocket(id).balance, before + 5 * ONE);
        assertEq(_pocket(id).lastEventBlock, START_BLOCK + 5);
        assertEq(usdc.allowance(cofunder, address(pockets)), 0, "exact approval fully used");
    }

    function test_ZeroAmountReverts() public {
        vm.prank(cofunder);
        vm.expectRevert(EarmarkPockets.InvalidAmount.selector);
        pockets.fund(id, 0);
    }

    function test_UnknownPocketReverts() public {
        vm.prank(cofunder);
        vm.expectRevert(EarmarkPockets.UnknownPocket.selector);
        pockets.fund(99, ONE);
        vm.expectRevert(EarmarkPockets.UnknownPocket.selector);
        pockets.fund(0, ONE);
    }

    function test_CreditsBalanceActuallyReceived() public {
        MockFeeUSDC feeToken = new MockFeeUSDC();
        EarmarkPockets feePockets = new EarmarkPockets(IERC20Metadata(address(feeToken)));
        feeToken.mint(sponsor, 1_000 * ONE);
        EarmarkPockets.CreateParams memory p = _food();
        p.deposit = 0;
        p.fuelTarget = 0; // this test checks the fee taken on the deposit, not the fee-credit top-up
        vm.startPrank(sponsor);
        uint256 fid = feePockets.createPocket(p, _none());
        feeToken.approve(address(feePockets), 100 * ONE);
        feePockets.fund(fid, 100 * ONE);
        vm.stopPrank();
        assertEq(feePockets.getPocket(fid).balance, 99 * ONE);
    }

    function test_FundingEmptyPocketTopsUpSpender() public {
        _burnSpenderFees(usdc.balanceOf(spender));
        EarmarkPockets.CreateParams memory p = _food();
        p.deposit = 0;
        uint256 emptyId = _create(p, _none());
        assertEq(usdc.balanceOf(spender), 0);
        assertEq(_pocket(emptyId).balance, 0);

        vm.startPrank(sponsor);
        usdc.approve(address(pockets), 30 * ONE);
        vm.expectEmit(address(pockets));
        emit EarmarkPockets.Funded(emptyId, sponsor, 30 * ONE, uint64(START_BLOCK));
        vm.expectEmit(address(pockets));
        emit EarmarkPockets.Refuelled(emptyId, spender, 50_000, uint64(START_BLOCK));
        pockets.fund(emptyId, 30 * ONE);
        vm.stopPrank();

        assertEq(usdc.balanceOf(spender), 50_000);
        EarmarkPockets.Pocket memory pk = _pocket(emptyId);
        assertEq(pk.balance, 30 * ONE - 50_000);
        assertEq(pk.fuelUsedInPeriod, 50_000);
        assertEq(pk.spentInPeriod, 0, "top-up is not spending");
    }

    function test_FundingRespectsTheCap() public {
        _burnSpenderFees(usdc.balanceOf(spender));
        EarmarkPockets.CreateParams memory p = _food();
        p.deposit = 0;
        p.fuelCapPerPeriod = 60_000;
        uint256 emptyId = _create(p, _none());

        _fund(sponsor, emptyId, 30 * ONE); // 0.05 of the 0.06 cap
        assertEq(usdc.balanceOf(spender), 50_000);
        _burnSpenderFees(50_000);
        _fund(sponsor, emptyId, 30 * ONE); // only 0.01 of cap left
        assertEq(usdc.balanceOf(spender), 10_000);
        assertEq(_pocket(emptyId).fuelUsedInPeriod, 60_000);

        _burnSpenderFees(10_000);
        _fund(sponsor, emptyId, ONE);
        assertEq(usdc.balanceOf(spender), 0, "cap used up");
        assertEq(_pocket(emptyId).fuelUsedInPeriod, 60_000);
    }

    function test_NoTopUpWhenSpenderHoldsHalfTheFloat() public {
        _burnSpenderFees(25_000); // 0.025 left: exactly half of the 0.05 float
        uint128 before = _pocket(id).balance;
        uint128 fuelUsed = _pocket(id).fuelUsedInPeriod;
        vm.recordLogs();
        _fund(cofunder, id, 5 * ONE);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter != address(pockets)) continue;
            assertTrue(logs[i].topics[0] != EarmarkPockets.Refuelled.selector, "no top-up at half");
        }
        assertEq(usdc.balanceOf(spender), 25_000);
        assertEq(_pocket(id).balance, before + 5 * ONE);
        assertEq(_pocket(id).fuelUsedInPeriod, fuelUsed);
    }

    function test_FundingRollsTheCapInANewPeriod() public {
        _burnSpenderFees(usdc.balanceOf(spender));
        EarmarkPockets.CreateParams memory p = _food();
        p.deposit = 0;
        p.fuelCapPerPeriod = 60_000;
        uint256 emptyId = _create(p, _none());
        _fund(sponsor, emptyId, 30 * ONE);
        _burnSpenderFees(usdc.balanceOf(spender));
        _fund(sponsor, emptyId, ONE); // uses the remaining 0.01 of this period's cap
        assertEq(usdc.balanceOf(spender), 10_000);
        assertEq(_pocket(emptyId).fuelUsedInPeriod, 60_000);
        _burnSpenderFees(10_000);

        vm.warp(START_TIME + 7 days);
        _fund(sponsor, emptyId, 30 * ONE);
        assertEq(usdc.balanceOf(spender), 50_000);
        EarmarkPockets.Pocket memory pk = _pocket(emptyId);
        assertEq(pk.fuelUsedInPeriod, 50_000);
        assertEq(pk.periodStart, START_TIME + 7 days);
        assertEq(pk.spentInPeriod, 0);
    }
}

contract SpendTest is EarmarkTestBase {
    uint256 internal id;

    function setUp() public override {
        super.setUp();
        id = _createFood();
    }

    function test_WithinLimit() public {
        uint128 before = _pocket(id).balance;
        vm.roll(START_BLOCK + 3);
        vm.expectEmit(address(pockets));
        emit EarmarkPockets.Spent(id, payee, 8 * ONE, "rice", uint64(START_BLOCK));
        vm.prank(spender);
        pockets.spend(id, payee, 8 * ONE, "rice");

        assertEq(usdc.balanceOf(payee), 8 * ONE);
        EarmarkPockets.Pocket memory pk = _pocket(id);
        assertEq(pk.balance, before - 8 * ONE);
        assertEq(pk.spentInPeriod, 8 * ONE);
        assertEq(pk.lastEventBlock, START_BLOCK + 3);
        assertEq(pockets.available(id), 12 * ONE);
    }

    function test_UpToTheLimitExactly() public {
        vm.startPrank(spender);
        pockets.spend(id, payee, 12 * ONE, "");
        pockets.spend(id, payee, 8 * ONE, "");
        vm.stopPrank();
        assertEq(pockets.available(id), 0);
    }

    function test_OverLimitRevertsWithAvailable() public {
        vm.startPrank(spender);
        pockets.spend(id, payee, 8 * ONE, "");
        vm.expectRevert(abi.encodeWithSelector(EarmarkPockets.OverLimit.selector, 12 * ONE));
        pockets.spend(id, payee, 15 * ONE, "");
        vm.stopPrank();
    }

    function test_OverLimitReportsBalanceWhenLower() public {
        EarmarkPockets.CreateParams memory p = _food();
        p.deposit = 5 * ONE;
        p.fuelTarget = 0;
        uint256 small = _create(p, _none());
        vm.prank(spender);
        vm.expectRevert(abi.encodeWithSelector(EarmarkPockets.OverLimit.selector, 5 * ONE));
        pockets.spend(small, payee, 21 * ONE, "");
    }

    function test_InsufficientBalanceReverts() public {
        EarmarkPockets.CreateParams memory p = _food();
        p.deposit = 5 * ONE;
        p.fuelTarget = 0;
        uint256 small = _create(p, _none());
        vm.prank(spender);
        vm.expectRevert(abi.encodeWithSelector(EarmarkPockets.InsufficientBalance.selector, 5 * ONE));
        pockets.spend(small, payee, 6 * ONE, "");
    }

    function test_RequestOnlyPocketRevertsOverLimit() public {
        EarmarkPockets.CreateParams memory p = _food();
        p.limitPerPeriod = 0;
        uint256 ro = _create(p, _none());
        assertEq(pockets.available(ro), 0);
        vm.prank(spender);
        vm.expectRevert(abi.encodeWithSelector(EarmarkPockets.OverLimit.selector, 0));
        pockets.spend(ro, payee, 1, "");
    }

    function test_PayeeOnly() public {
        EarmarkPockets.CreateParams memory p = _food();
        p.payeeOnly = true;
        uint256 po = _create(p, _one(payee));
        vm.startPrank(spender);
        vm.expectRevert(EarmarkPockets.PayeeNotApproved.selector);
        pockets.spend(po, stranger, ONE, "");
        pockets.spend(po, payee, ONE, "");
        vm.stopPrank();
        assertEq(usdc.balanceOf(payee), ONE);
    }

    function test_OnlySpender() public {
        vm.prank(sponsor);
        vm.expectRevert(EarmarkPockets.NotSpender.selector);
        pockets.spend(id, payee, ONE, "");
        vm.prank(stranger);
        vm.expectRevert(EarmarkPockets.NotSpender.selector);
        pockets.spend(id, payee, ONE, "");
    }

    function test_MemoLength() public {
        string memory memo64 = "1234567890123456789012345678901234567890123456789012345678901234";
        string memory memo65 = "12345678901234567890123456789012345678901234567890123456789012345";
        vm.startPrank(spender);
        pockets.spend(id, payee, ONE, memo64);
        vm.expectRevert(EarmarkPockets.MemoTooLong.selector);
        pockets.spend(id, payee, ONE, memo65);
        vm.stopPrank();
    }

    function test_ZeroAmountReverts() public {
        vm.prank(spender);
        vm.expectRevert(EarmarkPockets.InvalidAmount.selector);
        pockets.spend(id, payee, 0, "");
    }

    function test_InvalidRecipientReverts() public {
        vm.startPrank(spender);
        vm.expectRevert(EarmarkPockets.InvalidAddress.selector);
        pockets.spend(id, address(0), ONE, "");
        vm.expectRevert(EarmarkPockets.InvalidAddress.selector);
        pockets.spend(id, address(pockets), ONE, "");
        vm.stopPrank();
    }

    function test_UnknownPocketReverts() public {
        vm.prank(spender);
        vm.expectRevert(EarmarkPockets.UnknownPocket.selector);
        pockets.spend(42, payee, ONE, "");
    }

    function test_SpenderCanPayThemselves() public {
        vm.prank(spender);
        pockets.spend(id, spender, 2 * ONE, "cash out");
        assertEq(usdc.balanceOf(spender), 2 * ONE + 50_000);
    }

    function test_PeriodRolloverResetsLimit() public {
        vm.prank(spender);
        pockets.spend(id, payee, 20 * ONE, "");
        assertEq(pockets.available(id), 0);

        vm.warp(START_TIME + 7 days - 1);
        assertEq(pockets.available(id), 0, "still the same period");
        vm.prank(spender);
        vm.expectRevert(abi.encodeWithSelector(EarmarkPockets.OverLimit.selector, 0));
        pockets.spend(id, payee, 1, "");

        vm.warp(START_TIME + 7 days);
        // 9.95 USDC left in the pocket is below the fresh 20 USDC limit, so the balance is what is available.
        assertEq(pockets.available(id), _pocket(id).balance);
        assertEq(_pocket(id).balance, 10 * ONE - 50_000);
        vm.prank(spender);
        pockets.spend(id, payee, 5 * ONE, "");
        EarmarkPockets.Pocket memory pk = _pocket(id);
        assertEq(pk.periodStart, START_TIME + 7 days);
        assertEq(pk.spentInPeriod, 5 * ONE);
    }

    function test_PeriodRollSkipsWholePeriods() public {
        vm.warp(START_TIME + 3 * 7 days + 2 days);
        vm.prank(spender);
        pockets.spend(id, payee, ONE, "");
        assertEq(_pocket(id).periodStart, START_TIME + 3 * 7 days);
    }

    function test_TopsUpAfterSpending() public {
        _burnSpenderFees(30_000); // spender now holds 0.02, below half of 0.05
        vm.expectEmit(address(pockets));
        emit EarmarkPockets.Refuelled(id, spender, 30_000, uint64(START_BLOCK));
        vm.prank(spender);
        pockets.spend(id, payee, ONE, "");
        assertEq(usdc.balanceOf(spender), 50_000);
        EarmarkPockets.Pocket memory pk = _pocket(id);
        assertEq(pk.spentInPeriod, ONE, "top-up does not count against the limit");
        assertEq(pk.fuelUsedInPeriod, 80_000);
    }

    function test_BlocklistedRecipientReverts() public {
        MockBlocklistUSDC token = new MockBlocklistUSDC();
        EarmarkPockets bp = new EarmarkPockets(IERC20Metadata(address(token)));
        token.mint(sponsor, 100 * ONE);
        vm.startPrank(sponsor);
        token.approve(address(bp), 30 * ONE);
        uint256 bid = bp.createPocket(_food(), _none());
        vm.stopPrank();
        token.setBlocked(stranger, true);
        uint128 before = bp.getPocket(bid).balance;
        vm.prank(spender);
        vm.expectRevert(abi.encodeWithSelector(MockBlocklistUSDC.Blocklisted.selector, stranger));
        bp.spend(bid, stranger, ONE, "");
        assertEq(bp.getPocket(bid).balance, before, "whole call rolled back");
    }
}

contract RequestTest is EarmarkTestBase {
    uint256 internal id;

    function setUp() public override {
        super.setUp();
        id = _createFood();
    }

    function _ask(uint128 amount) internal returns (uint256 rid) {
        vm.prank(spender);
        rid = pockets.request(id, payee, amount, "textbooks");
    }

    function test_StoresPendingRequest() public {
        vm.roll(START_BLOCK + 2);
        vm.expectEmit(address(pockets));
        emit EarmarkPockets.Requested(id, 1, payee, 15 * ONE, "textbooks", uint64(START_BLOCK));
        uint256 rid = _ask(15 * ONE);
        assertEq(rid, 1);
        EarmarkPockets.Request memory r = pockets.getRequest(rid);
        assertEq(r.pocketId, id);
        assertEq(r.to, payee);
        assertEq(r.amount, 15 * ONE);
        assertEq(uint8(r.status), uint8(EarmarkPockets.Status.Pending));
        assertEq(r.memo, "textbooks");
        assertEq(pockets.pendingCount(id), 1);
        assertEq(pockets.requestsOf(id).length, 1);
        assertEq(pockets.requestCount(), 1);
        assertEq(_pocket(id).lastEventBlock, START_BLOCK + 2);
    }

    function test_AnyRecipientOnPayeeOnlyPocket() public {
        EarmarkPockets.CreateParams memory p = _food();
        p.payeeOnly = true;
        p.limitPerPeriod = 0;
        uint256 po = _create(p, _one(payee));
        vm.prank(spender);
        uint256 rid = pockets.request(po, stranger, 5 * ONE, "");
        vm.prank(sponsor);
        pockets.approveRequest(rid);
        assertEq(usdc.balanceOf(stranger), 5 * ONE);
    }

    function test_RequestChecks() public {
        vm.prank(sponsor);
        vm.expectRevert(EarmarkPockets.NotSpender.selector);
        pockets.request(id, payee, ONE, "");
        vm.startPrank(spender);
        vm.expectRevert(EarmarkPockets.InvalidAmount.selector);
        pockets.request(id, payee, 0, "");
        vm.expectRevert(EarmarkPockets.InvalidAddress.selector);
        pockets.request(id, address(0), ONE, "");
        vm.expectRevert(EarmarkPockets.MemoTooLong.selector);
        pockets.request(id, payee, ONE, "12345678901234567890123456789012345678901234567890123456789012345");
        vm.expectRevert(EarmarkPockets.UnknownPocket.selector);
        pockets.request(7, payee, ONE, "");
        vm.stopPrank();
    }

    function test_TwentyFirstPendingReverts() public {
        for (uint256 i; i < 20; ++i) {
            _ask(ONE);
        }
        assertEq(pockets.pendingCount(id), 20);
        vm.prank(spender);
        vm.expectRevert(EarmarkPockets.TooManyPending.selector);
        pockets.request(id, payee, ONE, "");

        vm.prank(sponsor);
        pockets.declineRequest(1);
        _ask(ONE); // a handled request frees a slot
        assertEq(pockets.pendingCount(id), 20);
    }

    function test_ApprovePaysRecipientOutsideLimit() public {
        vm.prank(spender);
        pockets.spend(id, payee, 20 * ONE, ""); // limit used up
        uint256 rid = _ask(5 * ONE);
        uint128 before = _pocket(id).balance;

        vm.roll(START_BLOCK + 9);
        vm.expectEmit(address(pockets));
        emit EarmarkPockets.Approved(id, rid, uint64(START_BLOCK));
        vm.prank(sponsor);
        pockets.approveRequest(rid);

        assertEq(usdc.balanceOf(payee), 25 * ONE);
        EarmarkPockets.Pocket memory pk = _pocket(id);
        assertEq(pk.balance, before - 5 * ONE);
        assertEq(pk.spentInPeriod, 20 * ONE, "approval does not touch the period limit");
        assertEq(uint8(pockets.getRequest(rid).status), uint8(EarmarkPockets.Status.Approved));
        assertEq(pockets.pendingCount(id), 0);
    }

    function test_ApproveWithShortBalanceReverts() public {
        uint256 rid = _ask(500 * ONE);
        uint128 balance = _pocket(id).balance;
        vm.prank(sponsor);
        vm.expectRevert(abi.encodeWithSelector(EarmarkPockets.InsufficientBalance.selector, balance));
        pockets.approveRequest(rid);
        assertEq(uint8(pockets.getRequest(rid).status), uint8(EarmarkPockets.Status.Pending));
    }

    function test_OnlySponsorDecides() public {
        uint256 rid = _ask(ONE);
        vm.prank(spender);
        vm.expectRevert(EarmarkPockets.NotSponsor.selector);
        pockets.approveRequest(rid);
        vm.prank(stranger);
        vm.expectRevert(EarmarkPockets.NotSponsor.selector);
        pockets.declineRequest(rid);
    }

    function test_DeclineKeepsMoney() public {
        uint256 rid = _ask(5 * ONE);
        uint128 before = _pocket(id).balance;
        vm.roll(START_BLOCK + 4);
        vm.expectEmit(address(pockets));
        emit EarmarkPockets.Declined(id, rid, uint64(START_BLOCK));
        vm.prank(sponsor);
        pockets.declineRequest(rid);
        assertEq(_pocket(id).balance, before);
        assertEq(uint8(pockets.getRequest(rid).status), uint8(EarmarkPockets.Status.Declined));
        assertEq(pockets.pendingCount(id), 0);
    }

    function test_DoubleHandlingReverts() public {
        uint256 a = _ask(ONE);
        uint256 b = _ask(ONE);
        vm.startPrank(sponsor);
        pockets.approveRequest(a);
        vm.expectRevert(EarmarkPockets.NotPending.selector);
        pockets.approveRequest(a);
        vm.expectRevert(EarmarkPockets.NotPending.selector);
        pockets.declineRequest(a);
        pockets.declineRequest(b);
        vm.expectRevert(EarmarkPockets.NotPending.selector);
        pockets.approveRequest(b);
        vm.stopPrank();
    }

    function test_UnknownRequestReverts() public {
        vm.prank(sponsor);
        vm.expectRevert(EarmarkPockets.NotPending.selector);
        pockets.approveRequest(99);
        vm.expectRevert(EarmarkPockets.NotPending.selector);
        pockets.getRequest(99);
        vm.expectRevert(EarmarkPockets.UnknownPocket.selector);
        pockets.requestsOf(99);
    }

    function test_RequestTopsUpAndRollsFuelPeriod() public {
        // Use up the whole fee-credit cap (0.10) this period.
        _burnSpenderFees(50_000);
        _ask(ONE); // tops up 0.05 -> used 0.10
        assertEq(_pocket(id).fuelUsedInPeriod, 100_000);
        _burnSpenderFees(50_000);
        _ask(ONE); // cap reached: no top-up
        assertEq(usdc.balanceOf(spender), 0);

        vm.warp(START_TIME + 7 days);
        _ask(ONE); // new period: the cap resets before the top-up
        assertEq(usdc.balanceOf(spender), 50_000);
        assertEq(_pocket(id).fuelUsedInPeriod, 50_000);
    }
}

contract WithdrawAndLockTest is EarmarkTestBase {
    function _locked(uint64 until) internal returns (uint256) {
        EarmarkPockets.CreateParams memory p = _food();
        p.lockUntil = until;
        return _create(p, _none());
    }

    function test_WithdrawWithoutLock() public {
        uint256 id = _createFood();
        uint128 before = _pocket(id).balance;
        vm.roll(START_BLOCK + 1);
        vm.expectEmit(address(pockets));
        emit EarmarkPockets.Withdrawn(id, stranger, 5 * ONE, uint64(START_BLOCK));
        vm.prank(sponsor);
        pockets.withdraw(id, 5 * ONE, stranger);
        assertEq(usdc.balanceOf(stranger), 5 * ONE);
        assertEq(_pocket(id).balance, before - 5 * ONE);
    }

    function test_SponsorCanTakeBackCoFunderMoney() public {
        uint256 id = _createFood();
        _fund(cofunder, id, 10 * ONE);
        uint128 all = _pocket(id).balance;
        vm.prank(sponsor);
        pockets.withdraw(id, all, sponsor);
        assertEq(_pocket(id).balance, 0);
    }

    function test_BlockedBeforeLockDate() public {
        uint64 until = START_TIME + 7 days;
        uint256 id = _locked(until);
        vm.warp(until - 1);
        vm.prank(sponsor);
        vm.expectRevert(abi.encodeWithSelector(EarmarkPockets.Locked.selector, until));
        pockets.withdraw(id, ONE, sponsor);
    }

    function test_AllowedAtAndAfterLockDate() public {
        uint64 until = START_TIME + 7 days;
        uint256 id = _locked(until);
        vm.warp(until);
        vm.prank(sponsor);
        pockets.withdraw(id, ONE, sponsor);
        vm.warp(until + 30 days);
        vm.prank(sponsor);
        pockets.withdraw(id, ONE, sponsor);
    }

    function test_WithdrawChecks() public {
        uint256 id = _createFood();
        vm.prank(spender);
        vm.expectRevert(EarmarkPockets.NotSponsor.selector);
        pockets.withdraw(id, ONE, spender);
        vm.startPrank(sponsor);
        vm.expectRevert(EarmarkPockets.InvalidAmount.selector);
        pockets.withdraw(id, 0, sponsor);
        vm.expectRevert(EarmarkPockets.InvalidAddress.selector);
        pockets.withdraw(id, ONE, address(0));
        uint128 balance = _pocket(id).balance;
        vm.expectRevert(abi.encodeWithSelector(EarmarkPockets.InsufficientBalance.selector, balance));
        pockets.withdraw(id, balance + 1, sponsor);
        vm.expectRevert(EarmarkPockets.UnknownPocket.selector);
        pockets.withdraw(9, ONE, sponsor);
        vm.stopPrank();
    }

    function test_ExtendLockForward() public {
        uint64 until = START_TIME + 7 days;
        uint256 id = _locked(until);
        vm.roll(START_BLOCK + 6);
        vm.expectEmit(address(pockets));
        emit EarmarkPockets.LockExtended(id, until + 1 days, uint64(START_BLOCK));
        vm.prank(sponsor);
        pockets.extendLock(id, until + 1 days);
        assertEq(_pocket(id).lockUntil, until + 1 days);
    }

    function test_ExtendLockNeverShortens() public {
        uint64 until = START_TIME + 7 days;
        uint256 id = _locked(until);
        vm.startPrank(sponsor);
        vm.expectRevert(EarmarkPockets.LockNotExtended.selector);
        pockets.extendLock(id, until);
        vm.expectRevert(EarmarkPockets.LockNotExtended.selector);
        pockets.extendLock(id, until - 1);
        vm.expectRevert(EarmarkPockets.BadLock.selector);
        pockets.extendLock(id, START_TIME + 730 days + 1);
        vm.stopPrank();
    }

    function test_ExtendLockOnUnlockedOrExpiredPocket() public {
        uint256 id = _createFood();
        vm.startPrank(sponsor);
        vm.expectRevert(EarmarkPockets.BadLock.selector);
        pockets.extendLock(id, START_TIME); // later than 0 but not in the future
        pockets.extendLock(id, START_TIME + 1 days);
        vm.stopPrank();

        vm.warp(START_TIME + 2 days); // the lock has passed
        vm.startPrank(sponsor);
        vm.expectRevert(EarmarkPockets.BadLock.selector);
        pockets.extendLock(id, START_TIME + 2 days);
        pockets.extendLock(id, START_TIME + 3 days);
        vm.stopPrank();
        assertEq(_pocket(id).lockUntil, START_TIME + 3 days);
    }

    function test_ExtendLockOnlySponsor() public {
        uint256 id = _locked(START_TIME + 7 days);
        vm.prank(spender);
        vm.expectRevert(EarmarkPockets.NotSponsor.selector);
        pockets.extendLock(id, START_TIME + 8 days);
        vm.expectRevert(EarmarkPockets.UnknownPocket.selector);
        pockets.extendLock(9, START_TIME + 8 days);
    }
}

contract RefuelTest is EarmarkTestBase {
    function test_TopsUpToTargetBelowHalf() public {
        uint256 id = _createFood();
        _burnSpenderFees(26_000); // 0.024 left: below half
        vm.prank(spender);
        pockets.spend(id, payee, ONE, "");
        assertEq(usdc.balanceOf(spender), 50_000);
    }

    function test_NoTopUpAtExactlyHalf() public {
        uint256 id = _createFood();
        _burnSpenderFees(25_000); // 0.025 left: exactly half
        vm.recordLogs();
        vm.prank(spender);
        pockets.spend(id, payee, ONE, "");
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 2, "Transfer and Spent only");
        assertEq(usdc.balanceOf(spender), 25_000);
    }

    function test_RespectsPeriodCap() public {
        EarmarkPockets.CreateParams memory p = _food();
        p.fuelCapPerPeriod = 60_000;
        uint256 id = _create(p, _none()); // 0.05 on creation
        _burnSpenderFees(50_000);
        vm.prank(spender);
        pockets.spend(id, payee, ONE, ""); // only 0.01 of cap left
        assertEq(usdc.balanceOf(spender), 10_000);
        _burnSpenderFees(10_000);
        vm.prank(spender);
        pockets.spend(id, payee, ONE, "");
        assertEq(usdc.balanceOf(spender), 0, "cap used up");
        assertEq(_pocket(id).fuelUsedInPeriod, 60_000);
    }

    function test_RespectsPocketBalance() public {
        EarmarkPockets.CreateParams memory p = _food();
        p.deposit = 20_000;
        uint256 id = _create(p, _none());
        assertEq(usdc.balanceOf(spender), 20_000);
        assertEq(_pocket(id).balance, 0);
    }

    function test_NoTopUpWhenFloatIsZero() public {
        EarmarkPockets.CreateParams memory p = _food();
        p.fuelTarget = 0;
        uint256 id = _create(p, _none());
        vm.prank(spender);
        pockets.spend(id, payee, ONE, "");
        assertEq(usdc.balanceOf(spender), 0);
        assertEq(_pocket(id).fuelUsedInPeriod, 0);
    }

    function test_TopUpsNeverCountAgainstLimit() public {
        uint256 id = _createFood();
        _burnSpenderFees(50_000);
        vm.prank(spender);
        pockets.spend(id, payee, 20 * ONE, ""); // the whole limit, then a top-up
        EarmarkPockets.Pocket memory pk = _pocket(id);
        assertEq(pk.spentInPeriod, 20 * ONE);
        assertEq(pk.fuelUsedInPeriod, 100_000);
        assertEq(usdc.balanceOf(spender), 50_000);
    }
}

contract NativeValueTest is EarmarkTestBase {
    function test_PlainSendReverts() public {
        vm.deal(stranger, 1 ether);
        vm.prank(stranger);
        (bool ok,) = address(pockets).call{value: 1}("");
        assertFalse(ok);
        assertEq(address(pockets).balance, 0);
    }

    function test_ValueWithACallReverts() public {
        uint256 id = _createFood();
        vm.deal(cofunder, 1 ether);
        vm.startPrank(cofunder);
        usdc.approve(address(pockets), ONE);
        (bool ok,) = address(pockets).call{value: 1}(abi.encodeCall(EarmarkPockets.fund, (id, ONE)));
        vm.stopPrank();
        assertFalse(ok);
        assertEq(address(pockets).balance, 0);
    }

    function test_UnknownFunctionReverts() public {
        (bool ok,) = address(pockets).call(abi.encodeWithSignature("approve(uint256)", 1));
        assertFalse(ok, "no fallback, and the sponsor action is approveRequest");
    }
}

contract ReentrancyTest is EarmarkTestBase {
    function test_CallbackDuringTransferReverts() public {
        MockReentrantUSDC token = new MockReentrantUSDC();
        EarmarkPockets rp = new EarmarkPockets(IERC20Metadata(address(token)));
        token.mint(sponsor, 100 * ONE);
        EarmarkPockets.CreateParams memory p = _food();
        p.fuelTarget = 0;
        vm.startPrank(sponsor);
        token.approve(address(rp), p.deposit);
        uint256 id = rp.createPocket(p, _none());
        vm.stopPrank();

        token.arm(address(rp), id);
        vm.prank(spender);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        rp.spend(id, payee, ONE, "");
    }
}

contract EventPointerTest is EarmarkTestBase {
    bytes32 internal constant FUNDED = keccak256("Funded(uint256,address,uint128,uint64)");
    bytes32 internal constant SPENT = keccak256("Spent(uint256,address,uint128,string,uint64)");

    /// @dev Reads `prevEventBlock`, the last data word of every pointer-carrying event.
    function _prev(Vm.Log memory log) internal pure returns (uint64 prev) {
        bytes memory data = log.data;
        if (log.topics[0] == SPENT) {
            (,, prev) = abi.decode(data, (uint128, string, uint64));
        } else {
            (, prev) = abi.decode(data, (uint128, uint64));
        }
    }

    function test_TwoEventsInOneBlock() public {
        uint256 id = _createFood(); // block 1000: created, funded, refuelled
        assertEq(_pocket(id).lastEventBlock, START_BLOCK);

        vm.roll(START_BLOCK + 5);
        vm.recordLogs();
        _fund(cofunder, id, ONE);
        _fund(cofunder, id, ONE); // second event in the same block
        Vm.Log[] memory logs = vm.getRecordedLogs();

        uint64[] memory prevs = new uint64[](2);
        uint256 n;
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter == address(pockets) && logs[i].topics[0] == FUNDED) prevs[n++] = _prev(logs[i]);
        }
        assertEq(n, 2);
        assertEq(prevs[0], START_BLOCK, "first points back to the creation block");
        assertEq(prevs[1], START_BLOCK + 5, "second points to its own block");
        assertEq(_pocket(id).lastEventBlock, START_BLOCK + 5);

        vm.roll(START_BLOCK + 9);
        vm.recordLogs();
        vm.prank(spender);
        pockets.spend(id, payee, ONE, "");
        logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter == address(pockets) && logs[i].topics[0] == SPENT) {
                assertEq(_prev(logs[i]), START_BLOCK + 5);
            }
        }
        assertEq(_pocket(id).lastEventBlock, START_BLOCK + 9);
    }

    function test_PointersArePerPocket() public {
        uint256 a = _createFood();
        vm.roll(START_BLOCK + 3);
        uint256 b = _createFood();
        vm.roll(START_BLOCK + 7);
        _fund(cofunder, a, ONE);
        assertEq(_pocket(a).lastEventBlock, START_BLOCK + 7);
        assertEq(_pocket(b).lastEventBlock, START_BLOCK + 3, "funding a leaves b's pointer alone");
    }
}

contract ViewTest is EarmarkTestBase {
    function test_AvailableAppliesVirtualRoll() public {
        EarmarkPockets.CreateParams memory p = _food();
        p.deposit = 100 * ONE;
        uint256 id = _create(p, _none());
        vm.prank(spender);
        pockets.spend(id, payee, 15 * ONE, "");
        assertEq(pockets.available(id), 5 * ONE);
        vm.warp(START_TIME + 7 days);
        assertEq(pockets.available(id), 20 * ONE, "new period, before anyone writes");
        assertEq(_pocket(id).spentInPeriod, 15 * ONE, "stored value unchanged");
    }

    function test_AvailableIsCappedByBalance() public {
        EarmarkPockets.CreateParams memory p = _food();
        p.deposit = 3 * ONE;
        p.fuelTarget = 0;
        uint256 id = _create(p, _none());
        assertEq(pockets.available(id), 3 * ONE);
    }

    function test_UnknownPocketReads() public {
        vm.expectRevert(EarmarkPockets.UnknownPocket.selector);
        pockets.getPocket(1);
        vm.expectRevert(EarmarkPockets.UnknownPocket.selector);
        pockets.available(1);
        vm.expectRevert(EarmarkPockets.UnknownPocket.selector);
        pockets.payeesOf(1);
        assertFalse(pockets.isPayee(1, payee));
        assertEq(pockets.pendingCount(1), 0);
    }

    function test_Constants() public view {
        assertEq(pockets.MAX_LABEL_BYTES(), 32);
        assertEq(pockets.MAX_MEMO_BYTES(), 64);
        assertEq(pockets.MIN_PERIOD(), 1 days);
        assertEq(pockets.MAX_PERIOD(), 31 days);
        assertEq(pockets.MAX_LOCK_AHEAD(), 730 days);
        assertEq(pockets.MAX_FUEL_TARGET(), 500_000);
        assertEq(pockets.MAX_FUEL_CAP(), 1_000_000);
        assertEq(pockets.MAX_PAYEES(), 10);
        assertEq(pockets.MAX_PENDING(), 20);
        assertEq(pockets.ICON_COUNT(), 10);
        assertEq(pockets.HUE_COUNT(), 6);
    }
}

contract SetPayeeTest is EarmarkTestBase {
    uint256 internal id;

    function setUp() public override {
        super.setUp();
        EarmarkPockets.CreateParams memory p = _food();
        p.payeeOnly = true;
        id = _create(p, _one(payee));
    }

    function test_AddsAndRemovesPayees() public {
        address second = makeAddr("second");
        vm.roll(START_BLOCK + 2);
        vm.expectEmit(address(pockets));
        emit EarmarkPockets.PayeeSet(id, second, true, uint64(START_BLOCK));
        vm.prank(sponsor);
        pockets.setPayee(id, second, true);
        assertTrue(pockets.isPayee(id, second));
        assertEq(pockets.payeesOf(id).length, 2);

        vm.prank(spender);
        pockets.spend(id, second, ONE, "");

        vm.expectEmit(address(pockets));
        emit EarmarkPockets.PayeeSet(id, payee, false, uint64(START_BLOCK + 2));
        vm.prank(sponsor);
        pockets.setPayee(id, payee, false);
        assertFalse(pockets.isPayee(id, payee));
        address[] memory list = pockets.payeesOf(id);
        assertEq(list.length, 1);
        assertEq(list[0], second);

        vm.prank(spender);
        vm.expectRevert(EarmarkPockets.PayeeNotApproved.selector);
        pockets.spend(id, payee, ONE, "");
    }

    function test_SettingTheSameStateIsANoOp() public {
        vm.recordLogs();
        vm.prank(sponsor);
        pockets.setPayee(id, payee, true);
        vm.prank(sponsor);
        pockets.setPayee(id, stranger, false);
        assertEq(vm.getRecordedLogs().length, 0);
        assertEq(pockets.payeesOf(id).length, 1);
    }

    function test_AtMostTenActivePayees() public {
        vm.startPrank(sponsor);
        for (uint256 i; i < 9; ++i) {
            pockets.setPayee(id, address(uint160(0x2000 + i)), true);
        }
        assertEq(pockets.payeesOf(id).length, 10);
        vm.expectRevert(EarmarkPockets.TooManyPayees.selector);
        pockets.setPayee(id, address(0x3000), true);
        pockets.setPayee(id, address(0x2004), false); // removing one frees a slot
        pockets.setPayee(id, address(0x3000), true);
        vm.stopPrank();
        assertEq(pockets.payeesOf(id).length, 10);
        assertTrue(pockets.isPayee(id, address(0x3000)));
        assertFalse(pockets.isPayee(id, address(0x2004)));
    }

    function test_Checks() public {
        vm.prank(spender);
        vm.expectRevert(EarmarkPockets.NotSponsor.selector);
        pockets.setPayee(id, stranger, true);
        vm.startPrank(sponsor);
        vm.expectRevert(EarmarkPockets.InvalidAddress.selector);
        pockets.setPayee(id, address(0), true);
        vm.expectRevert(EarmarkPockets.InvalidAddress.selector);
        pockets.setPayee(id, address(pockets), true);
        vm.expectRevert(EarmarkPockets.UnknownPocket.selector);
        pockets.setPayee(99, stranger, true);
        vm.stopPrank();
    }
}

contract SetLimitTest is EarmarkTestBase {
    uint256 internal id;

    function setUp() public override {
        super.setUp();
        id = _createFood();
    }

    function test_RaisesTheLimitAndKeepsWhatWasSpent() public {
        vm.prank(spender);
        pockets.spend(id, payee, 15 * ONE, "");
        vm.roll(START_BLOCK + 4);
        vm.expectEmit(address(pockets));
        emit EarmarkPockets.LimitChanged(id, 25 * ONE, uint64(START_BLOCK));
        vm.prank(sponsor);
        pockets.setLimit(id, 25 * ONE);
        assertEq(_pocket(id).limitPerPeriod, 25 * ONE);
        assertEq(_pocket(id).spentInPeriod, 15 * ONE, "spending so far still counts");
        assertEq(pockets.available(id), 10 * ONE);
    }

    function test_LoweringBelowSpentLeavesNothingUntilNextPeriod() public {
        vm.prank(spender);
        pockets.spend(id, payee, 15 * ONE, "");
        vm.prank(sponsor);
        pockets.setLimit(id, 10 * ONE);
        assertEq(pockets.available(id), 0);
        vm.prank(spender);
        vm.expectRevert(abi.encodeWithSelector(EarmarkPockets.OverLimit.selector, 0));
        pockets.spend(id, payee, 1, "");

        vm.warp(START_TIME + 7 days);
        assertEq(pockets.available(id), 10 * ONE);
        vm.prank(spender);
        pockets.spend(id, payee, 10 * ONE, "");
    }

    function test_ZeroMakesEveryPaymentARequest() public {
        vm.prank(sponsor);
        pockets.setLimit(id, 0);
        assertEq(pockets.available(id), 0);
        vm.prank(spender);
        vm.expectRevert(abi.encodeWithSelector(EarmarkPockets.OverLimit.selector, 0));
        pockets.spend(id, payee, 1, "");
    }

    function test_RollsAFinishedPeriodFirst() public {
        vm.prank(spender);
        pockets.spend(id, payee, 20 * ONE, "");
        vm.warp(START_TIME + 7 days + 1);
        vm.prank(sponsor);
        pockets.setLimit(id, 5 * ONE);
        EarmarkPockets.Pocket memory pk = _pocket(id);
        assertEq(pk.periodStart, START_TIME + 7 days);
        assertEq(pk.spentInPeriod, 0);
        assertEq(pockets.available(id), 5 * ONE);
    }

    function test_OnlySponsor() public {
        vm.prank(spender);
        vm.expectRevert(EarmarkPockets.NotSponsor.selector);
        pockets.setLimit(id, 100 * ONE);
        vm.expectRevert(EarmarkPockets.UnknownPocket.selector);
        pockets.setLimit(99, ONE);
    }
}

contract CancelRequestTest is EarmarkTestBase {
    uint256 internal id;

    function setUp() public override {
        super.setUp();
        id = _createFood();
    }

    function test_SpenderCancelsAndTheMoneyStays() public {
        vm.prank(spender);
        uint256 rid = pockets.request(id, payee, 5 * ONE, "shoes");
        uint128 before = _pocket(id).balance;
        vm.roll(START_BLOCK + 3);
        vm.expectEmit(address(pockets));
        emit EarmarkPockets.Cancelled(id, rid, uint64(START_BLOCK));
        vm.prank(spender);
        pockets.cancelRequest(rid);
        assertEq(uint8(pockets.getRequest(rid).status), uint8(EarmarkPockets.Status.Cancelled));
        assertEq(pockets.pendingCount(id), 0);
        assertEq(_pocket(id).balance, before);
        assertEq(_pocket(id).lastEventBlock, START_BLOCK + 3);

        vm.prank(sponsor);
        vm.expectRevert(EarmarkPockets.NotPending.selector);
        pockets.approveRequest(rid);
    }

    function test_OnlySpenderAndOnlyOnce() public {
        vm.prank(spender);
        uint256 rid = pockets.request(id, payee, ONE, "");
        vm.prank(sponsor);
        vm.expectRevert(EarmarkPockets.NotSpender.selector);
        pockets.cancelRequest(rid);
        vm.prank(stranger);
        vm.expectRevert(EarmarkPockets.NotSpender.selector);
        pockets.cancelRequest(rid);

        vm.startPrank(spender);
        pockets.cancelRequest(rid);
        vm.expectRevert(EarmarkPockets.NotPending.selector);
        pockets.cancelRequest(rid);
        vm.expectRevert(EarmarkPockets.NotPending.selector);
        pockets.cancelRequest(999);
        vm.stopPrank();
    }

    function test_CancellingFreesAPendingSlot() public {
        vm.startPrank(spender);
        for (uint256 i; i < 20; ++i) {
            pockets.request(id, payee, ONE, "");
        }
        vm.expectRevert(EarmarkPockets.TooManyPending.selector);
        pockets.request(id, payee, ONE, "");
        pockets.cancelRequest(3);
        pockets.request(id, payee, ONE, "");
        vm.stopPrank();
        assertEq(pockets.pendingCount(id), 20);
    }
}
