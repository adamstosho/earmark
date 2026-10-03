// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {EarmarkPockets} from "../src/EarmarkPockets.sol";
import {EarmarkTestBase} from "./utils/EarmarkTestBase.sol";

contract EarmarkPocketsFuzzTest is EarmarkTestBase {
    /// @dev Random limits, periods, amounts and time jumps: no period ever pays out more than its limit.
    function testFuzz_SpendingNeverExceedsLimitInAPeriod(
        uint128 limit,
        uint64 periodLength,
        uint128[12] memory amounts,
        uint32[12] memory jumps
    ) public {
        limit = uint128(bound(limit, 1, 1_000 * ONE));
        periodLength = uint64(bound(periodLength, 1 days, 31 days));
        EarmarkPockets.CreateParams memory p = _food();
        p.limitPerPeriod = limit;
        p.periodLength = periodLength;
        p.deposit = 100_000 * ONE;
        uint256 id = _create(p, _none());

        uint64 lastStart = _pocket(id).periodStart;
        uint256 paidThisPeriod;
        uint256 t = START_TIME;
        for (uint256 i; i < amounts.length; ++i) {
            t += bound(jumps[i], 0, 20 days);
            vm.warp(t);
            uint128 amount = uint128(bound(amounts[i], 1, 2 * limit));
            uint128 availableBefore = pockets.available(id);

            vm.prank(spender);
            try pockets.spend(id, payee, amount, "") {
                assertLe(amount, availableBefore, "paid more than was available");
                EarmarkPockets.Pocket memory pk = _pocket(id);
                if (pk.periodStart != lastStart) {
                    lastStart = pk.periodStart;
                    paidThisPeriod = 0;
                }
                paidThisPeriod += amount;
            } catch {
                assertGt(amount, availableBefore, "a spend within what was available failed");
            }

            EarmarkPockets.Pocket memory after_ = _pocket(id);
            assertLe(after_.spentInPeriod, after_.limitPerPeriod);
            assertLe(paidThisPeriod, limit);
            assertLe(after_.periodStart, t);
            assertEq((after_.periodStart - START_TIME) % periodLength, 0, "period starts stay on the grid");
        }
    }

    /// @dev Random funding, spending, requests and withdrawals: the contract always holds exactly the pocket balances.
    function testFuzz_BalancesReconcile(uint128[8] memory amounts, uint8[8] memory actions) public {
        uint256 a = _createFood();
        EarmarkPockets.CreateParams memory p = _food();
        p.limitPerPeriod = 0;
        uint256 b = _create(p, _none());

        for (uint256 i; i < actions.length; ++i) {
            uint256 id = i % 2 == 0 ? a : b;
            uint128 amount = uint128(bound(amounts[i], 1, 50 * ONE));
            uint8 action = actions[i] % 5;
            if (action == 0) {
                _fund(cofunder, id, uint128(bound(amount, 1, 10 * ONE)));
            } else if (action == 1) {
                vm.prank(spender);
                try pockets.spend(id, payee, amount, "") {} catch {}
            } else if (action == 2) {
                vm.prank(spender);
                try pockets.request(id, payee, amount, "") returns (uint256 rid) {
                    vm.prank(sponsor);
                    try pockets.approveRequest(rid) {} catch {}
                } catch {}
            } else if (action == 3) {
                vm.prank(sponsor);
                try pockets.withdraw(id, amount, sponsor) {} catch {}
            } else {
                _burnSpenderFees(usdc.balanceOf(spender));
            }
            assertEq(usdc.balanceOf(address(pockets)), uint256(_pocket(a).balance) + _pocket(b).balance);
        }
    }

    /// @dev `available` equals min(limit - spent after a virtual roll, balance), and 0 for request-only pockets.
    function testFuzz_AvailableMatchesDefinition(uint128 limit, uint128 deposit, uint128 spend, uint32 jump) public {
        limit = uint128(bound(limit, 0, 500 * ONE));
        deposit = uint128(bound(deposit, 0, 500 * ONE));
        EarmarkPockets.CreateParams memory p = _food();
        p.limitPerPeriod = limit;
        p.deposit = deposit;
        p.fuelTarget = 0;
        uint256 id = _create(p, _none());

        if (limit > 0 && deposit > 0) {
            spend = uint128(bound(spend, 1, limit < deposit ? limit : deposit));
            vm.prank(spender);
            pockets.spend(id, payee, spend, "");
        }
        uint256 t = START_TIME + bound(jump, 0, 30 days);
        vm.warp(t);

        EarmarkPockets.Pocket memory pk = _pocket(id);
        uint128 spent = t >= uint256(pk.periodStart) + pk.periodLength ? 0 : pk.spentInPeriod;
        uint128 left = limit > spent ? limit - spent : 0;
        uint128 expected = left < pk.balance ? left : pk.balance;
        assertEq(pockets.available(id), expected);
        if (limit == 0) assertEq(pockets.available(id), 0);
    }

    /// @dev A withdrawal succeeds exactly when the lock date has been reached.
    function testFuzz_LockWindow(uint64 lockAhead, uint64 wait) public {
        lockAhead = uint64(bound(lockAhead, 1, 730 days));
        wait = uint64(bound(wait, 0, 800 days));
        EarmarkPockets.CreateParams memory p = _food();
        p.lockUntil = START_TIME + lockAhead;
        uint256 id = _create(p, _none());

        vm.warp(START_TIME + wait);
        vm.prank(sponsor);
        if (wait < lockAhead) {
            vm.expectRevert(abi.encodeWithSelector(EarmarkPockets.Locked.selector, START_TIME + lockAhead));
            pockets.withdraw(id, ONE, sponsor);
        } else {
            pockets.withdraw(id, ONE, sponsor);
        }
    }

    /// @dev The lock only ever moves later.
    function testFuzz_LockNeverDecreases(uint64 first, uint64 second) public {
        first = uint64(bound(first, 1, 730 days));
        second = uint64(bound(second, 0, 800 days));
        EarmarkPockets.CreateParams memory p = _food();
        p.lockUntil = START_TIME + first;
        uint256 id = _create(p, _none());

        vm.prank(sponsor);
        try pockets.extendLock(id, START_TIME + second) {
            assertGt(second, first);
        } catch {
            assertTrue(second <= first || second > 730 days);
        }
        assertGe(_pocket(id).lockUntil, START_TIME + first);
    }

    /// @dev The top-up follows the PRD formula exactly.
    function testFuzz_RefuelFormula(uint128 target, uint128 cap, uint128 deposit, uint128 held) public {
        target = uint128(bound(target, 0, 500_000));
        cap = uint128(bound(cap, 0, 1_000_000));
        deposit = uint128(bound(deposit, 0, 2 * ONE));
        held = uint128(bound(held, 0, ONE));
        usdc.mint(spender, held);

        EarmarkPockets.CreateParams memory p = _food();
        p.fuelTarget = target;
        p.fuelCapPerPeriod = cap;
        p.deposit = deposit;
        uint256 id = _create(p, _none());

        uint256 expected;
        if (target > 0 && held < target / 2) {
            expected = target - held;
            if (cap < expected) expected = cap;
            if (deposit < expected) expected = deposit;
        }
        assertEq(usdc.balanceOf(spender), held + expected);
        assertEq(_pocket(id).fuelUsedInPeriod, expected);
        assertEq(_pocket(id).balance, deposit - expected);
        assertLe(_pocket(id).fuelUsedInPeriod, cap);
    }
}
