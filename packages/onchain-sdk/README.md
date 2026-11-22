# @protocolwealthos/onchain-sdk

> Typed client and models for an on-chain portfolio tracking service.

MIT-0 OR Apache-2.0 · part of [pwos-core](https://github.com/Protocol-Wealth/pwos-core).

## Quick start

```ts
import { OnchainPortfolioClient } from "@protocolwealthos/onchain-sdk";

const client = new OnchainPortfolioClient({
  baseUrl: "https://your-portfolio-service.example.com",
  apiKey: process.env.PORTFOLIO_API_KEY,
});

const clients = await client.listClients();
const balance = await client.getBalance("wallet_id");
```

Adapts to any HTTP service that speaks the documented endpoint shape — or wrap a different vendor (DeBank, Zerion, Covalent) behind the same interface by subclassing and overriding `request`.

## License

Licensed under MIT-0 OR Apache-2.0, at your option.
