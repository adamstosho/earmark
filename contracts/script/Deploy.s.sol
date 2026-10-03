// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {EarmarkPockets} from "../src/EarmarkPockets.sol";

/// @notice Deploys EarmarkPockets against Arc's USDC ERC-20 interface. Refuses any chain other than Arc mainnet
///         (5042) or Arc testnet (5042002). Run it only with the D6 fee flags (see docs/DEPLOY.md).
/// @dev Signs with PRIVATE_KEY from contracts/.env when it is set (PRD Section 12). Without it, Foundry's own signer
///      is used, so an encrypted keystore works too: `--account earmark-deployer --sender <address>`.
contract Deploy is Script {
    address internal constant ARC_USDC = 0x3600000000000000000000000000000000000000;

    function run() external returns (EarmarkPockets pockets) {
        require(block.chainid == 5042 || block.chainid == 5042002, "Deploy: not an Arc network");
        address usdc = vm.envOr("USDC", ARC_USDC);
        require(usdc == ARC_USDC, "Deploy: USDC must be Arc's ERC-20 interface");

        uint256 key = vm.envOr("PRIVATE_KEY", uint256(0));
        if (key != 0) vm.startBroadcast(key);
        else vm.startBroadcast();
        pockets = new EarmarkPockets(IERC20Metadata(usdc));
        vm.stopBroadcast();

        console.log("Chain id:", block.chainid);
        console.log("EarmarkPockets:", address(pockets));
    }
}
