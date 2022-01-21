// @ts-ignore
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.24.0/index.ts';
// @ts-ignore
import { assertEquals } from 'https://deno.land/std@0.122.0/testing/asserts.ts';

Clarinet.test({
    name: "Ensure that NFT token URL and ID is as expected",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_1 = accounts.get("wallet_1")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "get-last-token-id", [], wallet_1.address),
            Tx.contractCall("njefft", "get-token-uri", [types.uint(1)], wallet_1.address)
        ]);
        assertEquals(block.receipts.length, 2);
        assertEquals(block.height, 2);

        block.receipts[0].result.expectOk().expectUint(0);
        block.receipts[1].result.expectOk().expectSome().expectAscii("https://token.stacks.co/{id}.json");
    },
});

Clarinet.test({
    name: "Ensure NFT can be transferred",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet_1 = accounts.get("wallet_1")!;
        const wallet_2 = accounts.get("wallet_2")!;

        let block = chain.mineBlock([
            Tx.contractCall("njefft", "claim", [], wallet_1.address),
            Tx.contractCall("njefft", "get-last-token-id", [], wallet_1.address),
            Tx.contractCall("njefft", "get-token-uri", [types.uint(1)], wallet_1.address)
        ]);
        assertEquals(block.receipts.length, 3);
        assertEquals(block.height, 2);

        block.receipts[1].result.expectOk().expectUint(1);
        block.receipts[2].result.expectOk().expectSome().expectAscii("https://token.stacks.co/{id}.json");
    },
});

