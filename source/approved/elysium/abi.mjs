// Human-readable ABIs for every contract the Elysium section calls. Signatures were copied from
// the deployed sources (hoodstonk/contracts/src, hypurrswap-v3/src) and are also published on the
// Developers tab, so integrators read the same thing the UI does.
import { parseAbi } from 'viem';

const KEY = '(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks)';
const META = '(bytes32 imageCid, bytes32 bannerCid, bytes32 infoCid)';
const LAUNCH = `(string name, string symbol, uint256 supply, address pair, uint256 openingMarketCap, uint256 graduationThreshold, uint16 feeBps, uint16 sellFeeBps, uint16 burnBps, uint64 vestDuration, uint64 vestCliff, uint16 creatorBps, uint16 maxWalletBps, int24 tickSpacing, uint256 devBuyPairAmount, bytes32 salt, uint256 minPushPayout, uint256 minShareForQueue, address rewardCurrency, address feeRecipient, address referrer, uint32 openingWindow, uint16 openingFeeBps, ${META} metadata)`;

export const SOURCES = {
  erc20: [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
    'function allowance(address,address) view returns (uint256)',
    'function approve(address,uint256) returns (bool)',
  ],
  whype: ['function deposit() payable', 'function withdraw(uint256)'],
  launcher: [
    `function launch(${LAUNCH} p) returns (address token, bytes32 poolId)`,
    'function minDevBuyFor(address pair) view returns (uint256)',
    'function predictTokenAddress(bytes32 salt) view returns (address)',
    'function launchCount() view returns (uint256)',
    'function MAX_DEV_BUY_BPS() view returns (uint16)',
    'event Launched(address indexed token, address indexed creator, address indexed pair, bytes32 poolId, uint256 supply, uint256 openingMarketCap, uint16 feeBps)',
    'error OpeningPriceOutOfRange()',
    'error FeeBelowPlatformFloor(uint16 feeBps)',
    'error DevBuyTooLarge(uint256 amount, uint256 cap)',
    'error OpeningBuyRequired(uint256 amount, uint256 minimum)',
    'error PairNotApproved(address pair)',
    'error ImageRequired()',
    'error SupplyTooLow()',
    'error SeedTooLow()',
  ],
  feeHook: [
    'function poolConfig(bytes32) view returns (address distributor, address pairCurrency, uint16 feeBps, address creator, uint16 creatorBps, bool configured, uint16 sellFeeBps, uint16 burnBps, uint16 platformShareBps, uint16 sellPlatformShareBps, uint32 openingFeeEndsAt, uint32 openingWindow, uint16 openingFeeBps, address rewardCurrency)',
    'function effectiveSplitBps(bytes32) view returns (uint16 platformBps, uint16 creatorBps, uint16 holderBps)',
    'function currentBuyFeeBps(bytes32) view returns (uint16)',
    'function marketCapOf(bytes32) view returns (uint256)',
    'function pendingFees(bytes32) view returns (uint256)',
    'function pendingTokenFees(bytes32) view returns (uint256)',
    'function previewSweepBounty(uint256) view returns (uint256)',
    'function PLATFORM_VOLUME_BPS() view returns (uint16)',
    'function SWEEP_BOUNTY_BPS() view returns (uint16)',
    `function sweep(${KEY} key) returns (uint256)`,
  ],
  zap: [
    `function zapBuy(${KEY}[] ethKeys, ${KEY} tokenKey, uint256 minAmountOut, address recipient, uint256 deadline) payable returns (uint256)`,
    `function zapSell(${KEY}[] ethKeys, ${KEY} tokenKey, uint256 amountIn, uint256 minAmountOut, address recipient, uint256 deadline) returns (uint256)`,
    `function quoteZapBuy(${KEY}[] ethKeys, ${KEY} tokenKey, uint256 amountIn)`,
    `function quoteZapSell(${KEY}[] ethKeys, ${KEY} tokenKey, uint256 amountIn)`,
    'error ZapQuote(uint256 amountOut)',
    'error TooLittleReceived(uint256 got, uint256 minOut)',
    'error Expired(uint256 deadline, uint256 nowTimestamp)',
    'error NoSlippageFloor()',
  ],
  launchToken: ['function distributor() view returns (address)'],
  distributor: [
    'function withdrawableOf(address) view returns (uint256)',
    'function withdraw() returns (uint256)',
  ],
  vault: [
    'function owed(address,address) view returns (uint256)',
    'function claim(address currency) returns (uint256)',
    'function referrerOf(address) view returns (address)',
    'function tiers() view returns (uint16[])',
  ],
  v3Factory: [
    'function getPool(address,address,uint24) view returns (address)',
    'function owner() view returns (address)',
    'event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)',
  ],
  v3Pool: [
    'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8 feeProtocol, bool)',
    'function liquidity() view returns (uint128)',
    'function token0() view returns (address)',
    'function token1() view returns (address)',
    'function feeGrowthGlobal0X128() view returns (uint256)',
    'function feeGrowthGlobal1X128() view returns (uint256)',
    'function ticks(int24) view returns (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, int56, uint160, uint32, bool initialized)',
    'event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)',
    'event Mint(address sender, address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
    'event Burn(address indexed owner, int24 indexed tickLower, int24 indexed tickUpper, uint128 amount, uint256 amount0, uint256 amount1)',
  ],
  tickLens: [
    'function getPopulatedTicksInWord(address pool, int16 tickBitmapIndex) view returns ((int24 tick, int128 liquidityNet, uint128 liquidityGross)[] populatedTicks)',
  ],
  quoter: [
    'function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160, uint32, uint256)',
  ],
  router: [
    'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256)',
    'function unwrapWETH9(uint256 amountMinimum, address recipient) payable',
    'function multicall(bytes[] data) payable returns (bytes[])',
  ],
  npm: [
    'function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) payable returns (address)',
    'function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline) params) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
    'function increaseLiquidity((uint256 tokenId, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, uint256 deadline) params) payable returns (uint128 liquidity, uint256 amount0, uint256 amount1)',
    'function decreaseLiquidity((uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline) params) payable returns (uint256, uint256)',
    'function burn(uint256 tokenId) payable',
    'event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
    'event DecreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
    'event Collect(uint256 indexed tokenId, address recipient, uint256 amount0, uint256 amount1)',
    'function collect((uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max) params) payable returns (uint256, uint256)',
    'function refundETH() payable',
    'function unwrapWETH9(uint256 amountMinimum, address recipient) payable',
    'function sweepToken(address token, uint256 amountMinimum, address recipient) payable',
    'function multicall(bytes[] data) payable returns (bytes[])',
    'function balanceOf(address) view returns (uint256)',
    'function tokenOfOwnerByIndex(address,uint256) view returns (uint256)',
    'function positions(uint256) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256, uint256, uint128 tokensOwed0, uint128 tokensOwed1)',
  ],
  v4pm: [
    'event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)',
  ],
  arbSys: [
    'function withdrawEth(address destination) payable returns (uint256)',
    'event L2ToL1Tx(address caller, address indexed destination, uint256 indexed hash, uint256 indexed position, uint256 arbBlockNum, uint256 ethBlockNum, uint256 timestamp, uint256 callvalue, bytes data)',
  ],
  inbox: [
    'function depositEth() payable returns (uint256)',
    'function calculateRetryableSubmissionFee(uint256 dataLength, uint256 baseFee) view returns (uint256)',
  ],
  l1Router: [
    'function getGateway(address token) view returns (address)',
    'function outboundTransfer(address token, address to, uint256 amount, uint256 maxGas, uint256 gasPriceBid, bytes data) payable returns (bytes)',
  ],
  l1Gateway: ['function getOutboundCalldata(address token, address from, address to, uint256 amount, bytes data) view returns (bytes)'],
  l2Router: [
    'function calculateL2TokenAddress(address l1Token) view returns (address)',
    'function outboundTransfer(address l1Token, address to, uint256 amount, bytes data) payable returns (bytes)',
  ],
};

export const ABI = Object.fromEntries(Object.entries(SOURCES).map(([k, v]) => [k, parseAbi(v)]));
