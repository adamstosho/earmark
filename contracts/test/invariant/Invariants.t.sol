// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {EarmarkPockets} from "../../src/EarmarkPockets.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";
import {Handler} from "./Handler.sol";

/// @notice The seven invariants of PRD Section 7.6, checked after every call of random sequences.
contract EarmarkInvariants is StdInvariant, Test {
    MockUSDC internal usdc;
    EarmarkPockets internal pockets;
    Handler internal handler;

    function setUp() public {
        vm.warp(1_790_000_000);
        vm.roll(1_000);
        usdc = new MockUSDC();
        pockets = new EarmarkPockets(IERC20Metadata(address(usdc)));
        handler = new Handler(pockets, usdc);

        // Start with a few pockets so every action has something to act on.
        for (uint256 i; i < 4; ++i) {
            handler.createPocket(i * 7 + 1, 20e6, 7 days, 30 days, 100e6, 150_000);
        }

        bytes4[] memory selectors = new bytes4[](14);
        selectors[0] = Handler.createPocket.selector;
        selectors[1] = Handler.fund.selector;
        selectors[2] = Handler.spend.selector;
        selectors[3] = Handler.request.selector;
        selectors[4] = Handler.decide.selector;
        selectors[5] = Handler.withdraw.selector;
        selectors[6] = Handler.extendLock.selector;
        selectors[7] = Handler.intrude.selector;
        selectors[8] = Handler.payNetworkFees.selector;
        selectors[9] = Handler.warp.selector;
        selectors[10] = Handler.spend.selector; // spending is the core action: weight it twice
        selectors[11] = Handler.setPayee.selector;
        selectors[12] = Handler.setLimit.selector;
        selectors[13] = Handler.cancel.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        targetContract(address(handler));
    }

    /// 1. USDC held by the contract is always at least the sum of all pocket balances.
    function invariant_1_ContractHoldsEveryPocketBalance() public view {
        uint256 sum;
        uint256 n = pockets.pocketCount();
        for (uint256 id = 1; id <= n; ++id) {
            sum += pockets.getPocket(id).balance;
        }
        assertGe(usdc.balanceOf(address(pockets)), sum);
    }

    /// 2. spentInPeriod never exceeds limitPerPeriod within a period. No spend ever takes it above the limit in
    ///    force; it can only sit above the limit after the sponsor lowered the limit that same period (setLimit keeps
    ///    what was already spent, so nothing more can be spent until the next period).
    function invariant_2_SpentNeverExceedsLimit() public view {
        assertEq(handler.spendsOverLimit(), 0);
        uint256 n = pockets.pocketCount();
        for (uint256 id = 1; id <= n; ++id) {
            EarmarkPockets.Pocket memory pk = pockets.getPocket(id);
            if (pk.spentInPeriod > pk.limitPerPeriod) {
                assertEq(handler.loweredInPeriod(id), pk.periodStart, "over the limit without a lowering");
                if (block.timestamp < uint256(pk.periodStart) + pk.periodLength) assertEq(pockets.available(id), 0);
            }
            assertLe(pockets.available(id), pk.balance);
        }
    }

    /// 3. fuelUsedInPeriod never exceeds fuelCapPerPeriod within a period, and every `fund` top-up matches the formula.
    function invariant_3_FuelNeverExceedsCap() public view {
        assertEq(handler.refuelMismatches(), 0);
        uint256 n = pockets.pocketCount();
        for (uint256 id = 1; id <= n; ++id) {
            EarmarkPockets.Pocket memory pk = pockets.getPocket(id);
            assertLe(pk.fuelUsedInPeriod, pk.fuelCapPerPeriod);
        }
    }

    /// 4. No withdrawal succeeds while block.timestamp < lockUntil.
    function invariant_4_NoWithdrawalWhileLocked() public view {
        assertEq(handler.withdrawalsWhileLocked(), 0);
    }

    /// 5. lockUntil never decreases.
    function invariant_5_LockNeverDecreases() public view {
        assertEq(handler.lockDecreases(), 0);
    }

    /// 6. Only the spender can spend or request; only the sponsor can approve, decline, withdraw or change rules.
    function invariant_6_OnlyAuthorisedCallers() public view {
        assertEq(handler.unauthorisedSuccesses(), 0);
    }

    /// 7. A request leaves Pending at most once, and each pocket's pending count matches its pending requests.
    function invariant_7_RequestLeavesPendingOnce() public view {
        assertEq(handler.requestLeftPendingTwice(), 0);
        uint256 n = pockets.pocketCount();
        for (uint256 id = 1; id <= n; ++id) {
            uint256[] memory rids = pockets.requestsOf(id);
            uint256 pending;
            for (uint256 i; i < rids.length; ++i) {
                if (pockets.getRequest(rids[i]).status == EarmarkPockets.Status.Pending) ++pending;
            }
            assertEq(pockets.pendingCount(id), pending);
            assertLe(pending, 20);
        }
    }

    /// Logs how often each action succeeded (run with -vv), so a run that never exercised something is visible.
    function afterInvariant() external view {
        assertGt(handler.pocketCount(), 0);
        string[11] memory names = [
            "createPocket",
            "fund",
            "spend",
            "request",
            "approveRequest",
            "declineRequest",
            "withdraw",
            "extendLock",
            "setPayee",
            "setLimit",
            "cancelRequest"
        ];
        for (uint256 i; i < names.length; ++i) {
            console.log(names[i], handler.calls(keccak256(bytes(names[i]))));
        }
    }
}
