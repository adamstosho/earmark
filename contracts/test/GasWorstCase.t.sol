// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {console} from "forge-std/Test.sol";
import {EarmarkPockets} from "../src/EarmarkPockets.sol";
import {EarmarkTestBase} from "./utils/EarmarkTestBase.sol";

/// @notice Measures the worst case of every write (D7): 10 payees, a 32-byte label, a 64-byte memo, first-time
///         recipients and a fee-credit top-up to an empty wallet. Logs execution gas plus the 21,000 intrinsic cost
///         and calldata cost, which is what a transaction's gas limit must cover. Run with -vv.
contract GasWorstCaseTest is EarmarkTestBase {
    string internal constant LABEL32 = "School fees for the second term.";
    string internal constant MEMO64 = "Textbooks, uniform and exam fees for second term, paid in full o";

    function _calldataGas(bytes memory data) internal pure returns (uint256 cost) {
        for (uint256 i; i < data.length; ++i) {
            cost += data[i] == 0 ? 4 : 16;
        }
    }

    function _report(string memory name, uint256 execution, bytes memory data) internal pure returns (uint256 total) {
        total = execution + 21_000 + _calldataGas(data);
        console.log(name, total);
    }

    function _worstParams() internal view returns (EarmarkPockets.CreateParams memory p) {
        p = _food();
        p.label = LABEL32;
        p.payeeOnly = true;
        p.lockUntil = START_TIME + 700 days;
        p.fuelTarget = 500_000;
        p.fuelCapPerPeriod = 1_000_000;
        p.deposit = 50 * ONE;
    }

    function _tenPayees() internal pure returns (address[] memory list) {
        list = new address[](10);
        for (uint256 i; i < 10; ++i) {
            list[i] = address(uint160(0xA000 + i));
        }
    }

    function test_WorstCaseGas() public {
        assertEq(bytes(LABEL32).length, 32);
        assertEq(bytes(MEMO64).length, 64);

        // USDC approval (mock ERC-20; Arc's real cost is confirmed on testnet).
        vm.prank(sponsor);
        bytes memory approveData = abi.encodeWithSignature("approve(address,uint256)", address(pockets), 50 * ONE);
        uint256 g = gasleft();
        usdc.approve(address(pockets), 50 * ONE);
        _report("usdc.approve", g - gasleft(), approveData);

        // createPocket: 10 payees, 32-byte label, deposit, first top-up to an empty wallet.
        EarmarkPockets.CreateParams memory p = _worstParams();
        address[] memory payees = _tenPayees();
        bytes memory createData = abi.encodeCall(EarmarkPockets.createPocket, (p, payees));
        vm.prank(sponsor);
        g = gasleft();
        uint256 id = pockets.createPocket(p, payees);
        _report("createPocket", g - gasleft(), createData);

        // fund by a first-time co-funder after the period has ended, topping up an empty wallet.
        vm.warp(START_TIME + 7 days);
        _burnSpenderFees(usdc.balanceOf(spender));
        vm.prank(cofunder);
        usdc.approve(address(pockets), 10 * ONE);
        vm.prank(cofunder);
        g = gasleft();
        pockets.fund(id, 10 * ONE);
        _report("fund", g - gasleft(), abi.encodeCall(EarmarkPockets.fund, (id, 10 * ONE)));

        // spend: new period, 64-byte memo, first-time payee, and a top-up.
        vm.warp(START_TIME + 14 days);
        _burnSpenderFees(usdc.balanceOf(spender));
        address fresh = address(0xA000);
        bytes memory spendData = abi.encodeCall(EarmarkPockets.spend, (id, fresh, 20 * ONE, MEMO64));
        vm.prank(spender);
        g = gasleft();
        pockets.spend(id, fresh, 20 * ONE, MEMO64);
        _report("spend", g - gasleft(), spendData);

        // request: new period, 64-byte memo, and a top-up.
        vm.warp(START_TIME + 21 days);
        _burnSpenderFees(usdc.balanceOf(spender));
        bytes memory requestData = abi.encodeCall(EarmarkPockets.request, (id, stranger, 5 * ONE, MEMO64));
        vm.prank(spender);
        g = gasleft();
        uint256 rid = pockets.request(id, stranger, 5 * ONE, MEMO64);
        _report("request", g - gasleft(), requestData);

        // approveRequest to a first-time recipient.
        vm.prank(sponsor);
        g = gasleft();
        pockets.approveRequest(rid);
        _report("approveRequest", g - gasleft(), abi.encodeCall(EarmarkPockets.approveRequest, (rid)));

        vm.prank(spender);
        uint256 rid2 = pockets.request(id, stranger, 5 * ONE, MEMO64);
        vm.prank(sponsor);
        g = gasleft();
        pockets.declineRequest(rid2);
        _report("declineRequest", g - gasleft(), abi.encodeCall(EarmarkPockets.declineRequest, (rid2)));

        vm.prank(sponsor);
        uint64 later = uint64(START_TIME + 14 days + 720 days);
        g = gasleft();
        pockets.extendLock(id, later);
        _report("extendLock", g - gasleft(), abi.encodeCall(EarmarkPockets.extendLock, (id, later)));

        // withdraw to a first-time address after the lock.
        vm.warp(later);
        address newWallet = address(0xB000);
        vm.prank(sponsor);
        g = gasleft();
        pockets.withdraw(id, ONE, newWallet);
        _report("withdraw", g - gasleft(), abi.encodeCall(EarmarkPockets.withdraw, (id, ONE, newWallet)));

        // setPayee: removing the first of ten payees (the longest search), then adding a new one.
        vm.prank(sponsor);
        g = gasleft();
        pockets.setPayee(id, address(0xA000), false);
        _report(
            "setPayee (remove)", g - gasleft(), abi.encodeCall(EarmarkPockets.setPayee, (id, address(0xA000), false))
        );
        vm.prank(sponsor);
        g = gasleft();
        pockets.setPayee(id, address(0xC000), true);
        _report("setPayee (add)", g - gasleft(), abi.encodeCall(EarmarkPockets.setPayee, (id, address(0xC000), true)));

        // setLimit after a period has ended (rolls the period too).
        vm.warp(later + 30 days);
        vm.prank(sponsor);
        g = gasleft();
        pockets.setLimit(id, 40 * ONE);
        _report("setLimit", g - gasleft(), abi.encodeCall(EarmarkPockets.setLimit, (id, 40 * ONE)));

        vm.prank(spender);
        uint256 rid3 = pockets.request(id, stranger, ONE, MEMO64);
        vm.prank(spender);
        g = gasleft();
        pockets.cancelRequest(rid3);
        _report("cancelRequest", g - gasleft(), abi.encodeCall(EarmarkPockets.cancelRequest, (rid3)));
    }
}
