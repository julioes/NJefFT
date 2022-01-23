// @ts-ignore
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.24.0/index.ts';
// @ts-ignore
import { assertEquals } from 'https://deno.land/std@0.122.0/testing/asserts.ts';

const IPFS_ROOT = "QmNrq2BQYA6JQEsP4PQg5XX7YSfeud5ikigi9MZmEV6W9w"
const ERR_OWNER_ONLY = 100
const ERR_MINT_LIMIT = 101
const ERR_MINT_DISABLED = 102
const ERR_INVALID_INPUT = 103

Clarinet.test({
    name: "Ensure that NFT token URL and ID is as expected",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_2 = accounts.get("wallet_2")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "get-last-token-id", [], wallet_2.address),
            Tx.contractCall("njefft", "get-token-uri", [types.uint(1)], wallet_2.address)
        ]);
        assertEquals(block.receipts.length, 2);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectUint(0);
        block.receipts[1].result.expectOk().expectSome().expectAscii(`ipfs://ipfs/${IPFS_ROOT}/njefft-{id}-metadata.json`);
    },
});

Clarinet.test({
    name: "By default NFT is not mintable on deployment",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet_2 = accounts.get("wallet_2")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "get-mint-enabled", [], deployer.address),
            Tx.contractCall("njefft", "claim", [], deployer.address),
            Tx.contractCall("njefft", "get-last-token-id", [], wallet_2.address)
        ]);
        assertEquals(block.receipts.length, 3);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectBool(false);
        block.receipts[1].result.expectErr().expectUint(ERR_MINT_DISABLED);
        block.receipts[2].result.expectOk().expectUint(0);
    },
});

Clarinet.test({
    name: "NFT minting can be enabled by deployer",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet_2 = accounts.get("wallet_2")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "get-mint-enabled", [], deployer.address),
            Tx.contractCall("njefft", "toggle-enabled", [], deployer.address),
            Tx.contractCall("njefft", "get-mint-enabled", [], deployer.address),
            Tx.contractCall("njefft", "claim", [], deployer.address),
            Tx.contractCall("njefft", "get-last-token-id", [], wallet_2.address)
        ]);
        assertEquals(block.receipts.length, 5);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectBool(false);
        block.receipts[1].result.expectOk().expectBool(true);
        block.receipts[2].result.expectOk().expectBool(true);
        block.receipts[3].result.expectOk().expectBool(true);
        block.receipts[4].result.expectOk().expectUint(1);
    },
});

Clarinet.test({
    name: "NFT minting cannot be enabled by non-deployer",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_2 = accounts.get("wallet_2")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "get-mint-enabled", [], wallet_2.address),
            Tx.contractCall("njefft", "toggle-enabled", [], wallet_2.address),
            Tx.contractCall("njefft", "get-mint-enabled", [], wallet_2.address),
            Tx.contractCall("njefft", "get-last-token-id", [], wallet_2.address)
        ]);
        assertEquals(block.receipts.length, 4);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectBool(false);
        block.receipts[1].result.expectErr().expectUint(ERR_OWNER_ONLY);
        block.receipts[2].result.expectOk().expectBool(false);
        block.receipts[3].result.expectOk().expectUint(0);
    },
});

Clarinet.test({
    name: "NFT minting costs the price",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet_1 = accounts.get("wallet_1")!;
        const wallet_2 = accounts.get("wallet_2")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "toggle-enabled", [], deployer.address),
            Tx.contractCall("njefft", "get-price", [], deployer.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "get-last-token-id", [], wallet_2.address),
            Tx.contractCall("njefft", "get-owner", ["u1"], wallet_2.address)
        ]);
        assertEquals(block.receipts.length, 5);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectBool(true);
        const price = Number(block.receipts[1].result.expectOk().expectUint(1_000_000));
        block.receipts[2].result.expectOk().expectBool(true);
        block.receipts[2].events.expectSTXTransferEvent(price, wallet_2.address, wallet_1.address)
        block.receipts[3].result.expectOk().expectUint(1);
        block.receipts[4].result.expectOk().expectSome().expectPrincipal(wallet_2.address);
    },
});

Clarinet.test({
    name: "Deployer can change the price",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet_1 = accounts.get("wallet_1")!;
        const wallet_2 = accounts.get("wallet_2")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "toggle-enabled", [], deployer.address),
            Tx.contractCall("njefft", "set-price", ["u2000000"], deployer.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "get-last-token-id", [], wallet_2.address),
            Tx.contractCall("njefft", "get-owner", ["u1"], wallet_2.address)
        ]);
        assertEquals(block.receipts.length, 5);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectOk().expectBool(true);
        block.receipts[2].result.expectOk().expectBool(true);
        block.receipts[2].events.expectSTXTransferEvent(2_000_000, wallet_2.address, wallet_1.address)
        block.receipts[3].result.expectOk().expectUint(1);
        block.receipts[4].result.expectOk().expectSome().expectPrincipal(wallet_2.address);
    },
});

Clarinet.test({
    name: "Price cannot be changed by non-deployer",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_2 = accounts.get("wallet_2")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "set-price", ["u2000000"], wallet_2.address),
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectErr().expectUint(ERR_OWNER_ONLY);
    },
});

Clarinet.test({
    name: "Minting new tokens is limited by mint limit",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet_2 = accounts.get("wallet_2")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "toggle-enabled", [], deployer.address),
            Tx.contractCall("njefft", "get-mint-limit", [], wallet_2.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "get-last-token-id", [], wallet_2.address)
        ]);
        assertEquals(block.receipts.length, 5);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectOk().expectUint(1);
        block.receipts[2].result.expectOk().expectBool(true);
        block.receipts[3].result.expectErr().expectUint(ERR_MINT_LIMIT);
        block.receipts[4].result.expectOk().expectUint(1);
    },
});

Clarinet.test({
    name: "Deployer can change mint limit",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet_2 = accounts.get("wallet_2")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "toggle-enabled", [], deployer.address),
            Tx.contractCall("njefft", "get-mint-limit", [], wallet_2.address),
            Tx.contractCall("njefft", "set-mint-limit", ["u2"], deployer.address),
            Tx.contractCall("njefft", "get-mint-limit", [], wallet_2.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "get-last-token-id", [], wallet_2.address)
        ]);
        assertEquals(block.receipts.length, 7);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectOk().expectUint(1);
        block.receipts[2].result.expectOk().expectBool(true);
        block.receipts[3].result.expectOk().expectUint(2);
        block.receipts[4].result.expectOk().expectBool(true);
        block.receipts[5].result.expectOk().expectBool(true);
        block.receipts[6].result.expectOk().expectUint(2);
    },
});

Clarinet.test({
    name: "Non-deployer cannot change mint limit",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_2 = accounts.get("wallet_2")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "get-mint-limit", [], wallet_2.address),
            Tx.contractCall("njefft", "set-mint-limit", ["u2"], wallet_2.address),
            Tx.contractCall("njefft", "get-mint-limit", [], wallet_2.address)
        ]);
        assertEquals(block.receipts.length, 3);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectUint(1);
        block.receipts[1].result.expectErr().expectUint(ERR_OWNER_ONLY);
        block.receipts[2].result.expectOk().expectUint(1);
    },
});

Clarinet.test({
    name: "Deployer can change creator address",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet_1 = accounts.get("wallet_1")!;
        const wallet_2 = accounts.get("wallet_2")!;
        const wallet_3 = accounts.get("wallet_3")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "toggle-enabled", [], deployer.address),
            Tx.contractCall("njefft", "set-creator-address", [`'${wallet_3.address}`], deployer.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
        ]);
        assertEquals(block.receipts.length, 3);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectOk().expectBool(true);
        block.receipts[2].events.expectSTXTransferEvent(1_000_000, wallet_2.address, wallet_3.address)
        block.receipts[2].result.expectOk().expectBool(true);
    },
});

Clarinet.test({
    name: "Non-deployer cannot change creator address",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet_1 = accounts.get("wallet_1")!;
        const wallet_2 = accounts.get("wallet_2")!;
        const wallet_3 = accounts.get("wallet_3")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "set-creator-address", [`'${wallet_3.address}`], wallet_2.address)
        ]);
        assertEquals(block.receipts.length, 1);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectErr().expectUint(ERR_OWNER_ONLY);
    },
});

Clarinet.test({
    name: "Deployer can change ipfs cid",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet_2 = accounts.get("wallet_2")!;
        const newcid = "newcid123"

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "toggle-enabled", [], deployer.address),
            Tx.contractCall("njefft", "set-ipfs-cid", [`"${newcid}"`], deployer.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "get-token-uri", ["u1"], wallet_2.address)
        ]);
        assertEquals(block.receipts.length, 4);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectOk().expectBool(true);
        block.receipts[2].result.expectOk().expectBool(true);
        block.receipts[3].result.expectOk().expectSome().expectAscii(`ipfs://ipfs/${newcid}/njefft-{id}-metadata.json`);
    },
});

Clarinet.test({
    name: "Deployer cannot change to invalid ipfs cid",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet_2 = accounts.get("wallet_2")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "set-ipfs-cid", [`""`], deployer.address),
            Tx.contractCall("njefft", "get-token-uri", ["u1"], wallet_2.address)
        ]);
        assertEquals(block.receipts.length, 2);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectErr().expectUint(ERR_INVALID_INPUT);
        block.receipts[1].result.expectOk().expectSome().expectAscii(`ipfs://ipfs/${IPFS_ROOT}/njefft-{id}-metadata.json`);
    },
});

Clarinet.test({
    name: "Minted NFT can be transferred",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet_2 = accounts.get("wallet_2")!;
        const wallet_3 = accounts.get("wallet_3")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "toggle-enabled", [], deployer.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "get-owner", ["u1"], wallet_2.address),
            Tx.contractCall("njefft", "transfer", ["u1", `'${wallet_2.address}`, `'${wallet_3.address}`], wallet_2.address),
            Tx.contractCall("njefft", "get-owner", ["u1"], wallet_2.address)
        ]);
        assertEquals(block.receipts.length, 5);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectOk().expectBool(true);
        block.receipts[2].result.expectOk().expectSome().expectPrincipal(wallet_2.address);
        block.receipts[3].result.expectOk().expectBool(true);
        block.receipts[4].result.expectOk().expectSome().expectPrincipal(wallet_3.address);
    },
});

Clarinet.test({
    name: "Minted NFT can be transferred with memo",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet_2 = accounts.get("wallet_2")!;
        const wallet_3 = accounts.get("wallet_3")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "toggle-enabled", [], deployer.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "get-owner", ["u1"], wallet_2.address),
            Tx.contractCall("njefft", "transfer-memo", ["u1", `'${wallet_2.address}`, `'${wallet_3.address}`, "0x676767"], wallet_2.address),
            Tx.contractCall("njefft", "get-owner", ["u1"], wallet_2.address)
        ]);
        assertEquals(block.receipts.length, 5);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectOk().expectBool(true);
        block.receipts[2].result.expectOk().expectSome().expectPrincipal(wallet_2.address);
        block.receipts[3].result.expectOk().expectBool(true);
        block.receipts[4].result.expectOk().expectSome().expectPrincipal(wallet_3.address);
    },
});
