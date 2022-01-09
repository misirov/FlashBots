import { providers, Wallet } from "ethers";
import { FlashbotsBundleProvider, FlashbotsBundleResolution} from "@flashbots/ethers-provider-bundle";

// BigInt
const GWEI = 10n ** 9n;
const ETHER = 10n ** 18n;

// goerli testnet
const CHAIN_ID = 5; 
const FLASHBOTS_ENDPOINT = "https://relay-goerli.flashbots.net";

// Alchemy Goerli API
const provider = new providers.JsonRpcProvider(process.env.ALCHEMY_GOERLI_API);

// Create new wallet with out private key and the rpc provider
const wallet = new Wallet(process.env.PRIVATE_KEY, provider);


async function main() {

  // `signer` is an Ethereum private key that does NOT store funds and is NOT your bot's primary key.
  // This is an identifying key for signing payloads to establish reputation and whitelisting
  const signer = new Wallet.createRandom();


  // Flashbots provider requires passing in a standard provider and a signer
  const flashbot = await FlashbotsBundleProvider.create(provider, signer, FLASHBOTS_ENDPOINT);


  // Listening for events
  provider.on("block", async (blockNumber) => {
    console.log(`
    ---------------------------
    |--> Block number: ${blockNumber} |
    ---------------------------
    `);

    const signedTx = await flashbot.signBundle([
      {
        signer: wallet,
        transaction: {
          chainId: CHAIN_ID,
          type: 2,
          value: 0, // Need Goerli network test ether 
          data: "0x68656c6c6f", //hello
          maxFeePerGas: GWEI * 3n,
          maxPriorityFeePerGas: GWEI * 2n,
          gasLimit: 43000, // must always be over 42,000
          to: "0x26C4ca34f722BD8fD23D58f34576d8718c883A80", //waste gas contract: https://goerli.etherscan.io/address/0x26C4ca34f722BD8fD23D58f34576d8718c883A80#code
        },
      },
    ]);

    
    console.log('--> date: ', new Date());
    const targetBlock = blockNumber + 1
    const simulation = await flashbot.simulate(signedTx, targetBlock);
    

    if ("error" in simulation) {
      console.log(`--> Simulation error: ${simulation.error.message}`);
    } else {
      console.log(`--> Simulation success`);
    }
    

    // Submit Bundle
    const bundleSubmission = await flashbot.sendRawBundle(signedTx, targetBlock);
    console.log('Bundle submitted. Waiting...\n');
    if ("error" in bundleSubmission) {
      throw new Error(bundleSubmission.error.message);
    }


    // Wait for response. If Bundle is not included try again targeting next block. Else print transaction and exit(0)
    const response = await bundleSubmission.wait();
    console.log(`--> Received response: ${FlashbotsBundleResolution[response]}`)
    if (response === FlashbotsBundleResolution.BundleIncluded) {
      console.log(`> Bundle included in ${targetBlock}`);
      console.log(JSON.stringify(simulation, null, 2));
      process.exit(0);
    
    } else if (response === FlashbotsBundleResolution.BlockPassedWithoutInclusion || response === FlashbotsBundleResolution.AccountNonceTooHigh) {
      console.log(`> Bundle not included in ${targetBlock}`);
    
    } 
  
  });
}

main();
