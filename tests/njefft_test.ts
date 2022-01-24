// @ts-ignore
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.24.0/index.ts';
// @ts-ignore
import { assertEquals } from 'https://deno.land/std@0.122.0/testing/asserts.ts';

const IPFS_ROOT = "QmXbkRfwnC3yZ7zJQxicX6pu71vWErs2yx5eLmsfehV6bd"
const ERR_OWNER_ONLY = 100
const ERR_MINT_LIMIT = 101
const ERR_MINT_DISABLED = 102
const ERR_INVALID_INPUT = 103
const ERR_NOT_FOUND = 104
const ERR_LISTING = 105
const ERR_WRONG_COMMISSION = 106


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
            Tx.contractCall("njefft", "get-mint-price", [], deployer.address),
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
            Tx.contractCall("njefft", "set-mint-price", ["u2000000"], deployer.address),
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
            Tx.contractCall("njefft", "set-mint-price", ["u2000000"], wallet_2.address),
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
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "get-last-token-id", [], wallet_2.address)
        ]);
        assertEquals(block.receipts.length, 10);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectOk().expectUint(6);
        block.receipts[2].result.expectOk().expectBool(true);
        block.receipts[3].result.expectOk().expectBool(true);
        block.receipts[4].result.expectOk().expectBool(true);
        block.receipts[5].result.expectOk().expectBool(true);
        block.receipts[6].result.expectOk().expectBool(true);
        block.receipts[7].result.expectOk().expectBool(true);
        block.receipts[8].result.expectErr().expectUint(ERR_MINT_LIMIT);
        block.receipts[9].result.expectOk().expectUint(6);
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
            Tx.contractCall("njefft", "set-mint-limit", ["u1"], deployer.address),
            Tx.contractCall("njefft", "get-mint-limit", [], wallet_2.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "get-last-token-id", [], wallet_2.address)
        ]);
        assertEquals(block.receipts.length, 7);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectOk().expectUint(6);
        block.receipts[2].result.expectOk().expectBool(true);
        block.receipts[3].result.expectOk().expectUint(1);
        block.receipts[4].result.expectOk().expectBool(true);
        block.receipts[5].result.expectErr().expectUint(ERR_MINT_LIMIT);
        block.receipts[6].result.expectOk().expectUint(1);
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

        block.receipts[0].result.expectOk().expectUint(6);
        block.receipts[1].result.expectErr().expectUint(ERR_OWNER_ONLY);
        block.receipts[2].result.expectOk().expectUint(6);
    },
});

Clarinet.test({
    name: "Deployer cannot change mint limit below issued tokens",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet_2 = accounts.get("wallet_2")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "toggle-enabled", [], deployer.address),
            Tx.contractCall("njefft", "get-mint-limit", [], wallet_2.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "set-mint-limit", ["u1"], deployer.address),
            Tx.contractCall("njefft", "get-mint-limit", [], wallet_2.address),
            Tx.contractCall("njefft", "get-last-token-id", [], wallet_2.address)
        ]);
        assertEquals(block.receipts.length, 8);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectOk().expectUint(6);
        block.receipts[2].result.expectOk().expectBool(true);
        block.receipts[3].result.expectOk().expectBool(true);
        block.receipts[4].result.expectOk().expectBool(true);
        block.receipts[5].result.expectErr().expectUint(ERR_MINT_LIMIT);
        block.receipts[6].result.expectOk().expectUint(6);
        block.receipts[7].result.expectOk().expectUint(3);
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

Clarinet.test({
    name: "NFT can be listed by owner",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet_2 = accounts.get("wallet_2")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "toggle-enabled", [], deployer.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "list-in-ustx", ["u1", "u2", `'${deployer.address}.njefft`], wallet_2.address),
            Tx.contractCall("njefft", "get-listing-in-ustx", ["u1"], wallet_2.address)
        ]);
        assertEquals(block.receipts.length, 4);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectOk().expectBool(true);
        block.receipts[2].result.expectOk().expectBool(true);
        const listing = block.receipts[3].result.expectSome().expectTuple() as { [key: string]: String }
        assertEquals(listing["price"], "u2")
        assertEquals(listing["commission"], `${deployer.address}.njefft`)
    },
});

Clarinet.test({
    name: "NFT cannot be listed by non-owner",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet_2 = accounts.get("wallet_2")!;
        const wallet_3 = accounts.get("wallet_3")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "toggle-enabled", [], deployer.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "list-in-ustx", ["u1", "u2", `'${deployer.address}.njefft`], wallet_3.address),
            Tx.contractCall("njefft", "get-listing-in-ustx", ["u1"], wallet_2.address)
        ]);
        assertEquals(block.receipts.length, 4);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectOk().expectBool(true);
        block.receipts[2].result.expectErr().expectUint(ERR_OWNER_ONLY);
        block.receipts[3].result.expectNone();
    },
});

Clarinet.test({
    name: "NFT can be de-listed by owner",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet_2 = accounts.get("wallet_2")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "toggle-enabled", [], deployer.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "list-in-ustx", ["u1", "u2", `'${deployer.address}.njefft`], wallet_2.address),
            Tx.contractCall("njefft", "get-listing-in-ustx", ["u1"], wallet_2.address),
            Tx.contractCall("njefft", "unlist-in-ustx", ["u1"], wallet_2.address),
            Tx.contractCall("njefft", "get-listing-in-ustx", ["u1"], wallet_2.address)
        ]);
        assertEquals(block.receipts.length, 6);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectOk().expectBool(true);
        block.receipts[2].result.expectOk().expectBool(true);
        const listing = block.receipts[3].result.expectSome().expectTuple() as { [key: string]: String }
        assertEquals(listing["price"], "u2")
        assertEquals(listing["commission"], `${deployer.address}.njefft`)
        block.receipts[4].result.expectOk().expectBool(true);
        block.receipts[5].result.expectNone();
    },
});

Clarinet.test({
    name: "NFT cannot be de-listed by non-owner",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet_2 = accounts.get("wallet_2")!;
        const wallet_3 = accounts.get("wallet_3")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "toggle-enabled", [], deployer.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "list-in-ustx", ["u1", "u2", `'${deployer.address}.njefft`], wallet_2.address),
            Tx.contractCall("njefft", "get-listing-in-ustx", ["u1"], wallet_2.address),
            Tx.contractCall("njefft", "unlist-in-ustx", ["u1"], wallet_3.address),
            Tx.contractCall("njefft", "get-listing-in-ustx", ["u1"], wallet_2.address)
        ]);
        assertEquals(block.receipts.length, 6);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectOk().expectBool(true);
        block.receipts[2].result.expectOk().expectBool(true);
        let listing = block.receipts[3].result.expectSome().expectTuple() as { [key: string]: String }
        assertEquals(listing["price"], "u2")
        assertEquals(listing["commission"], `${deployer.address}.njefft`)
        block.receipts[4].result.expectErr().expectUint(ERR_OWNER_ONLY);
        listing = block.receipts[5].result.expectSome().expectTuple() as { [key: string]: String }
        assertEquals(listing["price"], "u2")
        assertEquals(listing["commission"], `${deployer.address}.njefft`)
    },
});

Clarinet.test({
    name: "Listed NFT can be purchased",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet_1 = accounts.get("wallet_1")!;
        const wallet_2 = accounts.get("wallet_2")!;
        const wallet_3 = accounts.get("wallet_3")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "toggle-enabled", [], deployer.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "list-in-ustx", ["u1", "u2000000", `'${deployer.address}.njefft`], wallet_2.address),
            Tx.contractCall("njefft", "buy-in-ustx", ["u1", `'${deployer.address}.njefft`], wallet_3.address),
            Tx.contractCall("njefft", "get-owner", ["u1"], wallet_2.address)
        ]);

        assertEquals(block.receipts.length, 5);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectOk().expectBool(true);
        block.receipts[2].result.expectOk().expectBool(true);
        block.receipts[3].result.expectOk().expectBool(true);
        block.receipts[3].events.expectSTXTransferEvent(2_000_000, wallet_3.address, wallet_2.address);
        block.receipts[3].events.expectSTXTransferEvent(40_000, wallet_3.address, wallet_1.address);
        block.receipts[4].result.expectOk().expectSome().expectPrincipal(wallet_3.address);
    },
});

Clarinet.test({
    name: "Unlisted NFT cannot be purchased",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet_1 = accounts.get("wallet_1")!;
        const wallet_2 = accounts.get("wallet_2")!;
        const wallet_3 = accounts.get("wallet_3")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "toggle-enabled", [], deployer.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "buy-in-ustx", ["u1", `'${deployer.address}.njefft`], wallet_3.address)
        ]);

        assertEquals(block.receipts.length, 3);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectOk().expectBool(true);
        block.receipts[2].result.expectErr().expectUint(ERR_LISTING);
    },
});

Clarinet.test({
    name: "Listed NFT cannot be transferred",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet_1 = accounts.get("wallet_1")!;
        const wallet_2 = accounts.get("wallet_2")!;
        const wallet_3 = accounts.get("wallet_3")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "toggle-enabled", [], deployer.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "list-in-ustx", ["u1", "u2", `'${deployer.address}.njefft`], wallet_2.address),
            Tx.contractCall("njefft", "transfer", ["u1", `'${wallet_2.address}`, `'${wallet_3.address}`], wallet_2.address)
        ]);

        assertEquals(block.receipts.length, 4);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectOk().expectBool(true);
        block.receipts[2].result.expectOk().expectBool(true);
        block.receipts[3].result.expectErr().expectUint(ERR_LISTING);
    },
});

Clarinet.test({
    name: "NFT can only be listed once",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet_1 = accounts.get("wallet_1")!;
        const wallet_2 = accounts.get("wallet_2")!;
        const wallet_3 = accounts.get("wallet_3")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "toggle-enabled", [], deployer.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "list-in-ustx", ["u1", "u2000000", `'${deployer.address}.njefft`], wallet_2.address),
            Tx.contractCall("njefft", "list-in-ustx", ["u1", "u4000000", `'${deployer.address}.njefft`], wallet_2.address),
            Tx.contractCall("njefft", "buy-in-ustx", ["u1", `'${deployer.address}.njefft`], wallet_3.address),
            Tx.contractCall("njefft", "get-owner", ["u1"], wallet_2.address)
        ]);

        assertEquals(block.receipts.length, 6);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectOk().expectBool(true);
        block.receipts[2].result.expectOk().expectBool(true);
        block.receipts[3].result.expectOk().expectBool(true);
        block.receipts[4].result.expectOk().expectBool(true);
        block.receipts[4].events.expectSTXTransferEvent(4_000_000, wallet_3.address, wallet_2.address);
        block.receipts[4].events.expectSTXTransferEvent(80_000, wallet_3.address, wallet_1.address);
        block.receipts[5].result.expectOk().expectSome().expectPrincipal(wallet_3.address);
    },
});

/*
Clarinet.test({
    name: "NFT can be listed - broken",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet_2 = accounts.get("wallet_2")!;
        const wallet_3 = accounts.get("wallet_3")!;
        const wallet_4 = accounts.get("wallet_4")!;

        const commContract = `(define-public (pay (id uint) (price uint)) (begin (try! (stx-transfer? price tx-sender '${wallet_4.address})) (ok true)))`
console.log('test')
console.log(commContract)
        let setupBlock = chain.mineBlock([
            Tx.deployContract("testcomm", commContract, wallet_4.address)
        ]);
        console.log(setupBlock)
        assertEquals(setupBlock.receipts.length, 1)
        assertEquals(setupBlock.height, 2)
        setupBlock.receipts[0].result.expectOk()

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "toggle-enabled", [], deployer.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
//            Tx.contractCall("njefft", "list-in-ustx", ["u1", "u2", `'${wallet_4.address}.test-comm`], wallet_2.address)
            Tx.contractCall("njefft", "list-in-ustx", ["u1", "u2", `'${deployer.address}.njefft`], wallet_2.address)

        ]);
        console.log(block)
        assertEquals(block.receipts.length, 3);
//        assertEquals(block.height, 3);

        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectOk().expectBool(true);
        block.receipts[2].result.expectOk().expectBool(true);
    },
});

Clarinet.test({
    name: "Listed NFT must be purchased with listed commission - broken",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const deployer = accounts.get("deployer")!;
        const wallet_2 = accounts.get("wallet_2")!;
        const wallet_3 = accounts.get("wallet_3")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "toggle-enabled", [], deployer.address),
            Tx.contractCall("njefft", "claim", [], wallet_2.address),
            Tx.contractCall("njefft", "list-in-ustx", ["u1", "u2", `'${deployer.address}.njefft`], wallet_2.address),
            Tx.contractCall("njefft", "buy-in-ustx", ["u1", `'${deployer.address}.njefft-commission`], wallet_3.address)
        ]);

        assertEquals(block.receipts.length, 4);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectBool(true);
        block.receipts[1].result.expectOk().expectBool(true);
        block.receipts[2].result.expectOk().expectBool(true);
        block.receipts[3].result.expectErr().expectUint(ERR_WRONG_COMMISSION);
    },
});
*/
