var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};

// ../hoodstonk/app/node_modules/abitype/dist/esm/version.js
var version;
var init_version = __esm({
  "../hoodstonk/app/node_modules/abitype/dist/esm/version.js"() {
    version = "1.2.3";
  }
});

// ../hoodstonk/app/node_modules/abitype/dist/esm/errors.js
var BaseError;
var init_errors = __esm({
  "../hoodstonk/app/node_modules/abitype/dist/esm/errors.js"() {
    init_version();
    BaseError = class _BaseError extends Error {
      constructor(shortMessage, args = {}) {
        const details = args.cause instanceof _BaseError ? args.cause.details : args.cause?.message ? args.cause.message : args.details;
        const docsPath5 = args.cause instanceof _BaseError ? args.cause.docsPath || args.docsPath : args.docsPath;
        const message = [
          shortMessage || "An error occurred.",
          "",
          ...args.metaMessages ? [...args.metaMessages, ""] : [],
          ...docsPath5 ? [`Docs: https://abitype.dev${docsPath5}`] : [],
          ...details ? [`Details: ${details}`] : [],
          `Version: abitype@${version}`
        ].join("\n");
        super(message);
        Object.defineProperty(this, "details", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "docsPath", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "metaMessages", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "shortMessage", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "name", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: "AbiTypeError"
        });
        if (args.cause)
          this.cause = args.cause;
        this.details = details;
        this.docsPath = docsPath5;
        this.metaMessages = args.metaMessages;
        this.shortMessage = shortMessage;
      }
    };
  }
});

// ../hoodstonk/app/node_modules/abitype/dist/esm/regex.js
function execTyped(regex, string) {
  const match = regex.exec(string);
  return match?.groups;
}
var bytesRegex, integerRegex, isTupleRegex;
var init_regex = __esm({
  "../hoodstonk/app/node_modules/abitype/dist/esm/regex.js"() {
    bytesRegex = /^bytes([1-9]|1[0-9]|2[0-9]|3[0-2])?$/;
    integerRegex = /^u?int(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/;
    isTupleRegex = /^\(.+?\).*?$/;
  }
});

// ../hoodstonk/app/node_modules/abitype/dist/esm/human-readable/formatAbiParameter.js
function formatAbiParameter(abiParameter) {
  let type = abiParameter.type;
  if (tupleRegex.test(abiParameter.type) && "components" in abiParameter) {
    type = "(";
    const length = abiParameter.components.length;
    for (let i = 0; i < length; i++) {
      const component = abiParameter.components[i];
      type += formatAbiParameter(component);
      if (i < length - 1)
        type += ", ";
    }
    const result = execTyped(tupleRegex, abiParameter.type);
    type += `)${result?.array || ""}`;
    return formatAbiParameter({
      ...abiParameter,
      type
    });
  }
  if ("indexed" in abiParameter && abiParameter.indexed)
    type = `${type} indexed`;
  if (abiParameter.name)
    return `${type} ${abiParameter.name}`;
  return type;
}
var tupleRegex;
var init_formatAbiParameter = __esm({
  "../hoodstonk/app/node_modules/abitype/dist/esm/human-readable/formatAbiParameter.js"() {
    init_regex();
    tupleRegex = /^tuple(?<array>(\[(\d*)\])*)$/;
  }
});

// ../hoodstonk/app/node_modules/abitype/dist/esm/human-readable/formatAbiParameters.js
function formatAbiParameters(abiParameters) {
  let params = "";
  const length = abiParameters.length;
  for (let i = 0; i < length; i++) {
    const abiParameter = abiParameters[i];
    params += formatAbiParameter(abiParameter);
    if (i !== length - 1)
      params += ", ";
  }
  return params;
}
var init_formatAbiParameters = __esm({
  "../hoodstonk/app/node_modules/abitype/dist/esm/human-readable/formatAbiParameters.js"() {
    init_formatAbiParameter();
  }
});

// ../hoodstonk/app/node_modules/abitype/dist/esm/human-readable/formatAbiItem.js
function formatAbiItem(abiItem) {
  if (abiItem.type === "function")
    return `function ${abiItem.name}(${formatAbiParameters(abiItem.inputs)})${abiItem.stateMutability && abiItem.stateMutability !== "nonpayable" ? ` ${abiItem.stateMutability}` : ""}${abiItem.outputs?.length ? ` returns (${formatAbiParameters(abiItem.outputs)})` : ""}`;
  if (abiItem.type === "event")
    return `event ${abiItem.name}(${formatAbiParameters(abiItem.inputs)})`;
  if (abiItem.type === "error")
    return `error ${abiItem.name}(${formatAbiParameters(abiItem.inputs)})`;
  if (abiItem.type === "constructor")
    return `constructor(${formatAbiParameters(abiItem.inputs)})${abiItem.stateMutability === "payable" ? " payable" : ""}`;
  if (abiItem.type === "fallback")
    return `fallback() external${abiItem.stateMutability === "payable" ? " payable" : ""}`;
  return "receive() external payable";
}
var init_formatAbiItem = __esm({
  "../hoodstonk/app/node_modules/abitype/dist/esm/human-readable/formatAbiItem.js"() {
    init_formatAbiParameters();
  }
});

// ../hoodstonk/app/node_modules/abitype/dist/esm/human-readable/runtime/signatures.js
function isErrorSignature(signature) {
  return errorSignatureRegex.test(signature);
}
function execErrorSignature(signature) {
  return execTyped(errorSignatureRegex, signature);
}
function isEventSignature(signature) {
  return eventSignatureRegex.test(signature);
}
function execEventSignature(signature) {
  return execTyped(eventSignatureRegex, signature);
}
function isFunctionSignature(signature) {
  return functionSignatureRegex.test(signature);
}
function execFunctionSignature(signature) {
  return execTyped(functionSignatureRegex, signature);
}
function isStructSignature(signature) {
  return structSignatureRegex.test(signature);
}
function execStructSignature(signature) {
  return execTyped(structSignatureRegex, signature);
}
function isConstructorSignature(signature) {
  return constructorSignatureRegex.test(signature);
}
function execConstructorSignature(signature) {
  return execTyped(constructorSignatureRegex, signature);
}
function isFallbackSignature(signature) {
  return fallbackSignatureRegex.test(signature);
}
function execFallbackSignature(signature) {
  return execTyped(fallbackSignatureRegex, signature);
}
function isReceiveSignature(signature) {
  return receiveSignatureRegex.test(signature);
}
var errorSignatureRegex, eventSignatureRegex, functionSignatureRegex, structSignatureRegex, constructorSignatureRegex, fallbackSignatureRegex, receiveSignatureRegex, eventModifiers, functionModifiers;
var init_signatures = __esm({
  "../hoodstonk/app/node_modules/abitype/dist/esm/human-readable/runtime/signatures.js"() {
    init_regex();
    errorSignatureRegex = /^error (?<name>[a-zA-Z$_][a-zA-Z0-9$_]*)\((?<parameters>.*?)\)$/;
    eventSignatureRegex = /^event (?<name>[a-zA-Z$_][a-zA-Z0-9$_]*)\((?<parameters>.*?)\)$/;
    functionSignatureRegex = /^function (?<name>[a-zA-Z$_][a-zA-Z0-9$_]*)\((?<parameters>.*?)\)(?: (?<scope>external|public{1}))?(?: (?<stateMutability>pure|view|nonpayable|payable{1}))?(?: returns\s?\((?<returns>.*?)\))?$/;
    structSignatureRegex = /^struct (?<name>[a-zA-Z$_][a-zA-Z0-9$_]*) \{(?<properties>.*?)\}$/;
    constructorSignatureRegex = /^constructor\((?<parameters>.*?)\)(?:\s(?<stateMutability>payable{1}))?$/;
    fallbackSignatureRegex = /^fallback\(\) external(?:\s(?<stateMutability>payable{1}))?$/;
    receiveSignatureRegex = /^receive\(\) external payable$/;
    eventModifiers = /* @__PURE__ */ new Set(["indexed"]);
    functionModifiers = /* @__PURE__ */ new Set([
      "calldata",
      "memory",
      "storage"
    ]);
  }
});

// ../hoodstonk/app/node_modules/abitype/dist/esm/human-readable/errors/abiItem.js
var UnknownTypeError, UnknownSolidityTypeError;
var init_abiItem = __esm({
  "../hoodstonk/app/node_modules/abitype/dist/esm/human-readable/errors/abiItem.js"() {
    init_errors();
    UnknownTypeError = class extends BaseError {
      constructor({ type }) {
        super("Unknown type.", {
          metaMessages: [
            `Type "${type}" is not a valid ABI type. Perhaps you forgot to include a struct signature?`
          ]
        });
        Object.defineProperty(this, "name", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: "UnknownTypeError"
        });
      }
    };
    UnknownSolidityTypeError = class extends BaseError {
      constructor({ type }) {
        super("Unknown type.", {
          metaMessages: [`Type "${type}" is not a valid ABI type.`]
        });
        Object.defineProperty(this, "name", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: "UnknownSolidityTypeError"
        });
      }
    };
  }
});

// ../hoodstonk/app/node_modules/abitype/dist/esm/human-readable/errors/abiParameter.js
var InvalidParameterError, SolidityProtectedKeywordError, InvalidModifierError, InvalidFunctionModifierError, InvalidAbiTypeParameterError;
var init_abiParameter = __esm({
  "../hoodstonk/app/node_modules/abitype/dist/esm/human-readable/errors/abiParameter.js"() {
    init_errors();
    InvalidParameterError = class extends BaseError {
      constructor({ param }) {
        super("Invalid ABI parameter.", {
          details: param
        });
        Object.defineProperty(this, "name", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: "InvalidParameterError"
        });
      }
    };
    SolidityProtectedKeywordError = class extends BaseError {
      constructor({ param, name }) {
        super("Invalid ABI parameter.", {
          details: param,
          metaMessages: [
            `"${name}" is a protected Solidity keyword. More info: https://docs.soliditylang.org/en/latest/cheatsheet.html`
          ]
        });
        Object.defineProperty(this, "name", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: "SolidityProtectedKeywordError"
        });
      }
    };
    InvalidModifierError = class extends BaseError {
      constructor({ param, type, modifier }) {
        super("Invalid ABI parameter.", {
          details: param,
          metaMessages: [
            `Modifier "${modifier}" not allowed${type ? ` in "${type}" type` : ""}.`
          ]
        });
        Object.defineProperty(this, "name", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: "InvalidModifierError"
        });
      }
    };
    InvalidFunctionModifierError = class extends BaseError {
      constructor({ param, type, modifier }) {
        super("Invalid ABI parameter.", {
          details: param,
          metaMessages: [
            `Modifier "${modifier}" not allowed${type ? ` in "${type}" type` : ""}.`,
            `Data location can only be specified for array, struct, or mapping types, but "${modifier}" was given.`
          ]
        });
        Object.defineProperty(this, "name", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: "InvalidFunctionModifierError"
        });
      }
    };
    InvalidAbiTypeParameterError = class extends BaseError {
      constructor({ abiParameter }) {
        super("Invalid ABI parameter.", {
          details: JSON.stringify(abiParameter, null, 2),
          metaMessages: ["ABI parameter type is invalid."]
        });
        Object.defineProperty(this, "name", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: "InvalidAbiTypeParameterError"
        });
      }
    };
  }
});

// ../hoodstonk/app/node_modules/abitype/dist/esm/human-readable/errors/signature.js
var InvalidSignatureError, UnknownSignatureError, InvalidStructSignatureError;
var init_signature = __esm({
  "../hoodstonk/app/node_modules/abitype/dist/esm/human-readable/errors/signature.js"() {
    init_errors();
    InvalidSignatureError = class extends BaseError {
      constructor({ signature, type }) {
        super(`Invalid ${type} signature.`, {
          details: signature
        });
        Object.defineProperty(this, "name", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: "InvalidSignatureError"
        });
      }
    };
    UnknownSignatureError = class extends BaseError {
      constructor({ signature }) {
        super("Unknown signature.", {
          details: signature
        });
        Object.defineProperty(this, "name", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: "UnknownSignatureError"
        });
      }
    };
    InvalidStructSignatureError = class extends BaseError {
      constructor({ signature }) {
        super("Invalid struct signature.", {
          details: signature,
          metaMessages: ["No properties exist."]
        });
        Object.defineProperty(this, "name", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: "InvalidStructSignatureError"
        });
      }
    };
  }
});

// ../hoodstonk/app/node_modules/abitype/dist/esm/human-readable/errors/struct.js
var CircularReferenceError;
var init_struct = __esm({
  "../hoodstonk/app/node_modules/abitype/dist/esm/human-readable/errors/struct.js"() {
    init_errors();
    CircularReferenceError = class extends BaseError {
      constructor({ type }) {
        super("Circular reference detected.", {
          metaMessages: [`Struct "${type}" is a circular reference.`]
        });
        Object.defineProperty(this, "name", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: "CircularReferenceError"
        });
      }
    };
  }
});

// ../hoodstonk/app/node_modules/abitype/dist/esm/human-readable/errors/splitParameters.js
var InvalidParenthesisError;
var init_splitParameters = __esm({
  "../hoodstonk/app/node_modules/abitype/dist/esm/human-readable/errors/splitParameters.js"() {
    init_errors();
    InvalidParenthesisError = class extends BaseError {
      constructor({ current, depth }) {
        super("Unbalanced parentheses.", {
          metaMessages: [
            `"${current.trim()}" has too many ${depth > 0 ? "opening" : "closing"} parentheses.`
          ],
          details: `Depth "${depth}"`
        });
        Object.defineProperty(this, "name", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: "InvalidParenthesisError"
        });
      }
    };
  }
});

// ../hoodstonk/app/node_modules/abitype/dist/esm/human-readable/runtime/cache.js
function getParameterCacheKey(param, type, structs) {
  let structKey = "";
  if (structs)
    for (const struct of Object.entries(structs)) {
      if (!struct)
        continue;
      let propertyKey = "";
      for (const property of struct[1]) {
        propertyKey += `[${property.type}${property.name ? `:${property.name}` : ""}]`;
      }
      structKey += `(${struct[0]}{${propertyKey}})`;
    }
  if (type)
    return `${type}:${param}${structKey}`;
  return `${param}${structKey}`;
}
var parameterCache;
var init_cache = __esm({
  "../hoodstonk/app/node_modules/abitype/dist/esm/human-readable/runtime/cache.js"() {
    parameterCache = /* @__PURE__ */ new Map([
      // Unnamed
      ["address", { type: "address" }],
      ["bool", { type: "bool" }],
      ["bytes", { type: "bytes" }],
      ["bytes32", { type: "bytes32" }],
      ["int", { type: "int256" }],
      ["int256", { type: "int256" }],
      ["string", { type: "string" }],
      ["uint", { type: "uint256" }],
      ["uint8", { type: "uint8" }],
      ["uint16", { type: "uint16" }],
      ["uint24", { type: "uint24" }],
      ["uint32", { type: "uint32" }],
      ["uint64", { type: "uint64" }],
      ["uint96", { type: "uint96" }],
      ["uint112", { type: "uint112" }],
      ["uint160", { type: "uint160" }],
      ["uint192", { type: "uint192" }],
      ["uint256", { type: "uint256" }],
      // Named
      ["address owner", { type: "address", name: "owner" }],
      ["address to", { type: "address", name: "to" }],
      ["bool approved", { type: "bool", name: "approved" }],
      ["bytes _data", { type: "bytes", name: "_data" }],
      ["bytes data", { type: "bytes", name: "data" }],
      ["bytes signature", { type: "bytes", name: "signature" }],
      ["bytes32 hash", { type: "bytes32", name: "hash" }],
      ["bytes32 r", { type: "bytes32", name: "r" }],
      ["bytes32 root", { type: "bytes32", name: "root" }],
      ["bytes32 s", { type: "bytes32", name: "s" }],
      ["string name", { type: "string", name: "name" }],
      ["string symbol", { type: "string", name: "symbol" }],
      ["string tokenURI", { type: "string", name: "tokenURI" }],
      ["uint tokenId", { type: "uint256", name: "tokenId" }],
      ["uint8 v", { type: "uint8", name: "v" }],
      ["uint256 balance", { type: "uint256", name: "balance" }],
      ["uint256 tokenId", { type: "uint256", name: "tokenId" }],
      ["uint256 value", { type: "uint256", name: "value" }],
      // Indexed
      [
        "event:address indexed from",
        { type: "address", name: "from", indexed: true }
      ],
      ["event:address indexed to", { type: "address", name: "to", indexed: true }],
      [
        "event:uint indexed tokenId",
        { type: "uint256", name: "tokenId", indexed: true }
      ],
      [
        "event:uint256 indexed tokenId",
        { type: "uint256", name: "tokenId", indexed: true }
      ]
    ]);
  }
});

// ../hoodstonk/app/node_modules/abitype/dist/esm/human-readable/runtime/utils.js
function parseSignature(signature, structs = {}) {
  if (isFunctionSignature(signature))
    return parseFunctionSignature(signature, structs);
  if (isEventSignature(signature))
    return parseEventSignature(signature, structs);
  if (isErrorSignature(signature))
    return parseErrorSignature(signature, structs);
  if (isConstructorSignature(signature))
    return parseConstructorSignature(signature, structs);
  if (isFallbackSignature(signature))
    return parseFallbackSignature(signature);
  if (isReceiveSignature(signature))
    return {
      type: "receive",
      stateMutability: "payable"
    };
  throw new UnknownSignatureError({ signature });
}
function parseFunctionSignature(signature, structs = {}) {
  const match = execFunctionSignature(signature);
  if (!match)
    throw new InvalidSignatureError({ signature, type: "function" });
  const inputParams = splitParameters(match.parameters);
  const inputs = [];
  const inputLength = inputParams.length;
  for (let i = 0; i < inputLength; i++) {
    inputs.push(parseAbiParameter(inputParams[i], {
      modifiers: functionModifiers,
      structs,
      type: "function"
    }));
  }
  const outputs = [];
  if (match.returns) {
    const outputParams = splitParameters(match.returns);
    const outputLength = outputParams.length;
    for (let i = 0; i < outputLength; i++) {
      outputs.push(parseAbiParameter(outputParams[i], {
        modifiers: functionModifiers,
        structs,
        type: "function"
      }));
    }
  }
  return {
    name: match.name,
    type: "function",
    stateMutability: match.stateMutability ?? "nonpayable",
    inputs,
    outputs
  };
}
function parseEventSignature(signature, structs = {}) {
  const match = execEventSignature(signature);
  if (!match)
    throw new InvalidSignatureError({ signature, type: "event" });
  const params = splitParameters(match.parameters);
  const abiParameters = [];
  const length = params.length;
  for (let i = 0; i < length; i++)
    abiParameters.push(parseAbiParameter(params[i], {
      modifiers: eventModifiers,
      structs,
      type: "event"
    }));
  return { name: match.name, type: "event", inputs: abiParameters };
}
function parseErrorSignature(signature, structs = {}) {
  const match = execErrorSignature(signature);
  if (!match)
    throw new InvalidSignatureError({ signature, type: "error" });
  const params = splitParameters(match.parameters);
  const abiParameters = [];
  const length = params.length;
  for (let i = 0; i < length; i++)
    abiParameters.push(parseAbiParameter(params[i], { structs, type: "error" }));
  return { name: match.name, type: "error", inputs: abiParameters };
}
function parseConstructorSignature(signature, structs = {}) {
  const match = execConstructorSignature(signature);
  if (!match)
    throw new InvalidSignatureError({ signature, type: "constructor" });
  const params = splitParameters(match.parameters);
  const abiParameters = [];
  const length = params.length;
  for (let i = 0; i < length; i++)
    abiParameters.push(parseAbiParameter(params[i], { structs, type: "constructor" }));
  return {
    type: "constructor",
    stateMutability: match.stateMutability ?? "nonpayable",
    inputs: abiParameters
  };
}
function parseFallbackSignature(signature) {
  const match = execFallbackSignature(signature);
  if (!match)
    throw new InvalidSignatureError({ signature, type: "fallback" });
  return {
    type: "fallback",
    stateMutability: match.stateMutability ?? "nonpayable"
  };
}
function parseAbiParameter(param, options) {
  const parameterCacheKey = getParameterCacheKey(param, options?.type, options?.structs);
  if (parameterCache.has(parameterCacheKey))
    return parameterCache.get(parameterCacheKey);
  const isTuple = isTupleRegex.test(param);
  const match = execTyped(isTuple ? abiParameterWithTupleRegex : abiParameterWithoutTupleRegex, param);
  if (!match)
    throw new InvalidParameterError({ param });
  if (match.name && isSolidityKeyword(match.name))
    throw new SolidityProtectedKeywordError({ param, name: match.name });
  const name = match.name ? { name: match.name } : {};
  const indexed = match.modifier === "indexed" ? { indexed: true } : {};
  const structs = options?.structs ?? {};
  let type;
  let components = {};
  if (isTuple) {
    type = "tuple";
    const params = splitParameters(match.type);
    const components_ = [];
    const length = params.length;
    for (let i = 0; i < length; i++) {
      components_.push(parseAbiParameter(params[i], { structs }));
    }
    components = { components: components_ };
  } else if (match.type in structs) {
    type = "tuple";
    components = { components: structs[match.type] };
  } else if (dynamicIntegerRegex.test(match.type)) {
    type = `${match.type}256`;
  } else if (match.type === "address payable") {
    type = "address";
  } else {
    type = match.type;
    if (!(options?.type === "struct") && !isSolidityType(type))
      throw new UnknownSolidityTypeError({ type });
  }
  if (match.modifier) {
    if (!options?.modifiers?.has?.(match.modifier))
      throw new InvalidModifierError({
        param,
        type: options?.type,
        modifier: match.modifier
      });
    if (functionModifiers.has(match.modifier) && !isValidDataLocation(type, !!match.array))
      throw new InvalidFunctionModifierError({
        param,
        type: options?.type,
        modifier: match.modifier
      });
  }
  const abiParameter = {
    type: `${type}${match.array ?? ""}`,
    ...name,
    ...indexed,
    ...components
  };
  parameterCache.set(parameterCacheKey, abiParameter);
  return abiParameter;
}
function splitParameters(params, result = [], current = "", depth = 0) {
  const length = params.trim().length;
  for (let i = 0; i < length; i++) {
    const char = params[i];
    const tail = params.slice(i + 1);
    switch (char) {
      case ",":
        return depth === 0 ? splitParameters(tail, [...result, current.trim()]) : splitParameters(tail, result, `${current}${char}`, depth);
      case "(":
        return splitParameters(tail, result, `${current}${char}`, depth + 1);
      case ")":
        return splitParameters(tail, result, `${current}${char}`, depth - 1);
      default:
        return splitParameters(tail, result, `${current}${char}`, depth);
    }
  }
  if (current === "")
    return result;
  if (depth !== 0)
    throw new InvalidParenthesisError({ current, depth });
  result.push(current.trim());
  return result;
}
function isSolidityType(type) {
  return type === "address" || type === "bool" || type === "function" || type === "string" || bytesRegex.test(type) || integerRegex.test(type);
}
function isSolidityKeyword(name) {
  return name === "address" || name === "bool" || name === "function" || name === "string" || name === "tuple" || bytesRegex.test(name) || integerRegex.test(name) || protectedKeywordsRegex.test(name);
}
function isValidDataLocation(type, isArray) {
  return isArray || type === "bytes" || type === "string" || type === "tuple";
}
var abiParameterWithoutTupleRegex, abiParameterWithTupleRegex, dynamicIntegerRegex, protectedKeywordsRegex;
var init_utils = __esm({
  "../hoodstonk/app/node_modules/abitype/dist/esm/human-readable/runtime/utils.js"() {
    init_regex();
    init_abiItem();
    init_abiParameter();
    init_signature();
    init_splitParameters();
    init_cache();
    init_signatures();
    abiParameterWithoutTupleRegex = /^(?<type>[a-zA-Z$_][a-zA-Z0-9$_]*(?:\spayable)?)(?<array>(?:\[\d*?\])+?)?(?:\s(?<modifier>calldata|indexed|memory|storage{1}))?(?:\s(?<name>[a-zA-Z$_][a-zA-Z0-9$_]*))?$/;
    abiParameterWithTupleRegex = /^\((?<type>.+?)\)(?<array>(?:\[\d*?\])+?)?(?:\s(?<modifier>calldata|indexed|memory|storage{1}))?(?:\s(?<name>[a-zA-Z$_][a-zA-Z0-9$_]*))?$/;
    dynamicIntegerRegex = /^u?int$/;
    protectedKeywordsRegex = /^(?:after|alias|anonymous|apply|auto|byte|calldata|case|catch|constant|copyof|default|defined|error|event|external|false|final|function|immutable|implements|in|indexed|inline|internal|let|mapping|match|memory|mutable|null|of|override|partial|private|promise|public|pure|reference|relocatable|return|returns|sizeof|static|storage|struct|super|supports|switch|this|true|try|typedef|typeof|var|view|virtual)$/;
  }
});

// ../hoodstonk/app/node_modules/abitype/dist/esm/human-readable/runtime/structs.js
function parseStructs(signatures) {
  const shallowStructs = {};
  const signaturesLength = signatures.length;
  for (let i = 0; i < signaturesLength; i++) {
    const signature = signatures[i];
    if (!isStructSignature(signature))
      continue;
    const match = execStructSignature(signature);
    if (!match)
      throw new InvalidSignatureError({ signature, type: "struct" });
    const properties = match.properties.split(";");
    const components = [];
    const propertiesLength = properties.length;
    for (let k = 0; k < propertiesLength; k++) {
      const property = properties[k];
      const trimmed = property.trim();
      if (!trimmed)
        continue;
      const abiParameter = parseAbiParameter(trimmed, {
        type: "struct"
      });
      components.push(abiParameter);
    }
    if (!components.length)
      throw new InvalidStructSignatureError({ signature });
    shallowStructs[match.name] = components;
  }
  const resolvedStructs = {};
  const entries = Object.entries(shallowStructs);
  const entriesLength = entries.length;
  for (let i = 0; i < entriesLength; i++) {
    const [name, parameters] = entries[i];
    resolvedStructs[name] = resolveStructs(parameters, shallowStructs);
  }
  return resolvedStructs;
}
function resolveStructs(abiParameters = [], structs = {}, ancestors = /* @__PURE__ */ new Set()) {
  const components = [];
  const length = abiParameters.length;
  for (let i = 0; i < length; i++) {
    const abiParameter = abiParameters[i];
    const isTuple = isTupleRegex.test(abiParameter.type);
    if (isTuple)
      components.push(abiParameter);
    else {
      const match = execTyped(typeWithoutTupleRegex, abiParameter.type);
      if (!match?.type)
        throw new InvalidAbiTypeParameterError({ abiParameter });
      const { array, type } = match;
      if (type in structs) {
        if (ancestors.has(type))
          throw new CircularReferenceError({ type });
        components.push({
          ...abiParameter,
          type: `tuple${array ?? ""}`,
          components: resolveStructs(structs[type], structs, /* @__PURE__ */ new Set([...ancestors, type]))
        });
      } else {
        if (isSolidityType(type))
          components.push(abiParameter);
        else
          throw new UnknownTypeError({ type });
      }
    }
  }
  return components;
}
var typeWithoutTupleRegex;
var init_structs = __esm({
  "../hoodstonk/app/node_modules/abitype/dist/esm/human-readable/runtime/structs.js"() {
    init_regex();
    init_abiItem();
    init_abiParameter();
    init_signature();
    init_struct();
    init_signatures();
    init_utils();
    typeWithoutTupleRegex = /^(?<type>[a-zA-Z$_][a-zA-Z0-9$_]*)(?<array>(?:\[\d*?\])+?)?$/;
  }
});

// ../hoodstonk/app/node_modules/abitype/dist/esm/human-readable/parseAbi.js
function parseAbi(signatures) {
  const structs = parseStructs(signatures);
  const abi = [];
  const length = signatures.length;
  for (let i = 0; i < length; i++) {
    const signature = signatures[i];
    if (isStructSignature(signature))
      continue;
    abi.push(parseSignature(signature, structs));
  }
  return abi;
}
var init_parseAbi = __esm({
  "../hoodstonk/app/node_modules/abitype/dist/esm/human-readable/parseAbi.js"() {
    init_signatures();
    init_structs();
    init_utils();
  }
});

// ../hoodstonk/app/node_modules/abitype/dist/esm/exports/index.js
var init_exports = __esm({
  "../hoodstonk/app/node_modules/abitype/dist/esm/exports/index.js"() {
    init_formatAbiItem();
    init_parseAbi();
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/abi/formatAbiItem.js
function formatAbiItem2(abiItem, { includeName = false } = {}) {
  if (abiItem.type !== "function" && abiItem.type !== "event" && abiItem.type !== "error")
    throw new InvalidDefinitionTypeError(abiItem.type);
  return `${abiItem.name}(${formatAbiParams(abiItem.inputs, { includeName })})`;
}
function formatAbiParams(params, { includeName = false } = {}) {
  if (!params)
    return "";
  return params.map((param) => formatAbiParam(param, { includeName })).join(includeName ? ", " : ",");
}
function formatAbiParam(param, { includeName }) {
  if (param.type.startsWith("tuple")) {
    return `(${formatAbiParams(param.components, { includeName })})${param.type.slice("tuple".length)}`;
  }
  return param.type + (includeName && param.name ? ` ${param.name}` : "");
}
var init_formatAbiItem2 = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/abi/formatAbiItem.js"() {
    init_abi();
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/data/isHex.js
function isHex(value, { strict = true } = {}) {
  if (!value)
    return false;
  if (typeof value !== "string")
    return false;
  return strict ? /^0x[0-9a-fA-F]*$/.test(value) : value.startsWith("0x");
}
var init_isHex = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/data/isHex.js"() {
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/data/size.js
function size(value) {
  if (isHex(value, { strict: false }))
    return Math.ceil((value.length - 2) / 2);
  return value.length;
}
var init_size = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/data/size.js"() {
    init_isHex();
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/errors/version.js
var version2;
var init_version2 = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/errors/version.js"() {
    version2 = "2.56.0";
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/errors/base.js
function walk(err, fn) {
  if (fn?.(err))
    return err;
  if (err && typeof err === "object" && "cause" in err && err.cause !== void 0)
    return walk(err.cause, fn);
  return fn ? null : err;
}
var errorConfig, BaseError2;
var init_base = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/errors/base.js"() {
    init_version2();
    errorConfig = {
      getDocsUrl: ({ docsBaseUrl, docsPath: docsPath5 = "", docsSlug }) => docsPath5 ? `${docsBaseUrl ?? "https://viem.sh"}${docsPath5}${docsSlug ? `#${docsSlug}` : ""}` : void 0,
      version: `viem@${version2}`
    };
    BaseError2 = class _BaseError extends Error {
      constructor(shortMessage, args = {}) {
        const details = (() => {
          if (args.cause instanceof _BaseError)
            return args.cause.details;
          if (args.cause?.message)
            return args.cause.message;
          return args.details;
        })();
        const docsPath5 = (() => {
          if (args.cause instanceof _BaseError)
            return args.cause.docsPath || args.docsPath;
          return args.docsPath;
        })();
        const docsUrl = errorConfig.getDocsUrl?.({ ...args, docsPath: docsPath5 });
        const message = [
          shortMessage || "An error occurred.",
          "",
          ...args.metaMessages ? [...args.metaMessages, ""] : [],
          ...docsUrl ? [`Docs: ${docsUrl}`] : [],
          ...details ? [`Details: ${details}`] : [],
          ...errorConfig.version ? [`Version: ${errorConfig.version}`] : []
        ].join("\n");
        super(message, args.cause ? { cause: args.cause } : void 0);
        Object.defineProperty(this, "details", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "docsPath", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "metaMessages", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "shortMessage", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "version", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "name", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: "BaseError"
        });
        this.details = details;
        this.docsPath = docsPath5;
        this.metaMessages = args.metaMessages;
        this.name = args.name ?? this.name;
        this.shortMessage = shortMessage;
        this.version = version2;
      }
      walk(fn) {
        return walk(this, fn);
      }
    };
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/errors/abi.js
var AbiDecodingDataSizeTooSmallError, AbiDecodingZeroDataError, AbiEncodingArrayLengthMismatchError, AbiEncodingBytesSizeMismatchError, AbiEncodingLengthMismatchError, AbiEventSignatureEmptyTopicsError, AbiEventSignatureNotFoundError, AbiEventNotFoundError, AbiFunctionNotFoundError, AbiFunctionOutputsNotFoundError, AbiItemAmbiguityError, DecodeLogDataMismatch, DecodeLogTopicsMismatch, InvalidAbiEncodingTypeError, InvalidAbiDecodingTypeError, InvalidArrayError, InvalidDefinitionTypeError;
var init_abi = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/errors/abi.js"() {
    init_formatAbiItem2();
    init_size();
    init_base();
    AbiDecodingDataSizeTooSmallError = class extends BaseError2 {
      constructor({ data, params, size: size2 }) {
        super([`Data size of ${size2} bytes is too small for given parameters.`].join("\n"), {
          metaMessages: [
            `Params: (${formatAbiParams(params, { includeName: true })})`,
            `Data:   ${data} (${size2} bytes)`
          ],
          name: "AbiDecodingDataSizeTooSmallError"
        });
        Object.defineProperty(this, "data", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "params", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "size", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        this.data = data;
        this.params = params;
        this.size = size2;
      }
    };
    AbiDecodingZeroDataError = class extends BaseError2 {
      constructor({ cause } = {}) {
        super('Cannot decode zero data ("0x") with ABI parameters.', {
          name: "AbiDecodingZeroDataError",
          cause
        });
      }
    };
    AbiEncodingArrayLengthMismatchError = class extends BaseError2 {
      constructor({ expectedLength, givenLength, type }) {
        super([
          `ABI encoding array length mismatch for type ${type}.`,
          `Expected length: ${expectedLength}`,
          `Given length: ${givenLength}`
        ].join("\n"), { name: "AbiEncodingArrayLengthMismatchError" });
      }
    };
    AbiEncodingBytesSizeMismatchError = class extends BaseError2 {
      constructor({ expectedSize, value }) {
        super(`Size of bytes "${value}" (bytes${size(value)}) does not match expected size (bytes${expectedSize}).`, { name: "AbiEncodingBytesSizeMismatchError" });
      }
    };
    AbiEncodingLengthMismatchError = class extends BaseError2 {
      constructor({ expectedLength, givenLength }) {
        super([
          "ABI encoding params/values length mismatch.",
          `Expected length (params): ${expectedLength}`,
          `Given length (values): ${givenLength}`
        ].join("\n"), { name: "AbiEncodingLengthMismatchError" });
      }
    };
    AbiEventSignatureEmptyTopicsError = class extends BaseError2 {
      constructor({ docsPath: docsPath5 }) {
        super("Cannot extract event signature from empty topics.", {
          docsPath: docsPath5,
          name: "AbiEventSignatureEmptyTopicsError"
        });
      }
    };
    AbiEventSignatureNotFoundError = class extends BaseError2 {
      constructor(signature, { docsPath: docsPath5 }) {
        super([
          `Encoded event signature "${signature}" not found on ABI.`,
          "Make sure you are using the correct ABI and that the event exists on it.",
          `You can look up the signature here: https://4byte.sourcify.dev/?q=${signature}.`
        ].join("\n"), {
          docsPath: docsPath5,
          name: "AbiEventSignatureNotFoundError"
        });
      }
    };
    AbiEventNotFoundError = class extends BaseError2 {
      constructor(eventName, { docsPath: docsPath5 } = {}) {
        super([
          `Event ${eventName ? `"${eventName}" ` : ""}not found on ABI.`,
          "Make sure you are using the correct ABI and that the event exists on it."
        ].join("\n"), {
          docsPath: docsPath5,
          name: "AbiEventNotFoundError"
        });
      }
    };
    AbiFunctionNotFoundError = class extends BaseError2 {
      constructor(functionName, { docsPath: docsPath5 } = {}) {
        super([
          `Function ${functionName ? `"${functionName}" ` : ""}not found on ABI.`,
          "Make sure you are using the correct ABI and that the function exists on it."
        ].join("\n"), {
          docsPath: docsPath5,
          name: "AbiFunctionNotFoundError"
        });
      }
    };
    AbiFunctionOutputsNotFoundError = class extends BaseError2 {
      constructor(functionName, { docsPath: docsPath5 }) {
        super([
          `Function "${functionName}" does not contain any \`outputs\` on ABI.`,
          "Cannot decode function result without knowing what the parameter types are.",
          "Make sure you are using the correct ABI and that the function exists on it."
        ].join("\n"), {
          docsPath: docsPath5,
          name: "AbiFunctionOutputsNotFoundError"
        });
      }
    };
    AbiItemAmbiguityError = class extends BaseError2 {
      constructor(x, y) {
        super("Found ambiguous types in overloaded ABI items.", {
          metaMessages: [
            `\`${x.type}\` in \`${formatAbiItem2(x.abiItem)}\`, and`,
            `\`${y.type}\` in \`${formatAbiItem2(y.abiItem)}\``,
            "",
            "These types encode differently and cannot be distinguished at runtime.",
            "Remove one of the ambiguous items in the ABI."
          ],
          name: "AbiItemAmbiguityError"
        });
      }
    };
    DecodeLogDataMismatch = class extends BaseError2 {
      constructor({ abiItem, data, params, size: size2 }) {
        super([
          `Data size of ${size2} bytes is too small for non-indexed event parameters.`
        ].join("\n"), {
          metaMessages: [
            `Params: (${formatAbiParams(params, { includeName: true })})`,
            `Data:   ${data} (${size2} bytes)`
          ],
          name: "DecodeLogDataMismatch"
        });
        Object.defineProperty(this, "abiItem", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "data", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "params", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, "size", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        this.abiItem = abiItem;
        this.data = data;
        this.params = params;
        this.size = size2;
      }
    };
    DecodeLogTopicsMismatch = class extends BaseError2 {
      constructor({ abiItem, param }) {
        super([
          `Expected a topic for indexed event parameter${param.name ? ` "${param.name}"` : ""} on event "${formatAbiItem2(abiItem, { includeName: true })}".`
        ].join("\n"), { name: "DecodeLogTopicsMismatch" });
        Object.defineProperty(this, "abiItem", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        this.abiItem = abiItem;
      }
    };
    InvalidAbiEncodingTypeError = class extends BaseError2 {
      constructor(type, { docsPath: docsPath5 }) {
        super([
          `Type "${type}" is not a valid encoding type.`,
          "Please provide a valid ABI type."
        ].join("\n"), { docsPath: docsPath5, name: "InvalidAbiEncodingType" });
      }
    };
    InvalidAbiDecodingTypeError = class extends BaseError2 {
      constructor(type, { docsPath: docsPath5 }) {
        super([
          `Type "${type}" is not a valid decoding type.`,
          "Please provide a valid ABI type."
        ].join("\n"), { docsPath: docsPath5, name: "InvalidAbiDecodingType" });
      }
    };
    InvalidArrayError = class extends BaseError2 {
      constructor(value) {
        super([`Value "${value}" is not a valid array.`].join("\n"), {
          name: "InvalidArrayError"
        });
      }
    };
    InvalidDefinitionTypeError = class extends BaseError2 {
      constructor(type) {
        super([
          `"${type}" is not a valid definition type.`,
          'Valid types: "function", "event", "error"'
        ].join("\n"), { name: "InvalidDefinitionTypeError" });
      }
    };
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/errors/data.js
var SliceOffsetOutOfBoundsError, SizeExceedsPaddingSizeError;
var init_data = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/errors/data.js"() {
    init_base();
    SliceOffsetOutOfBoundsError = class extends BaseError2 {
      constructor({ offset, position, size: size2 }) {
        super(`Slice ${position === "start" ? "starting" : "ending"} at offset "${offset}" is out-of-bounds (size: ${size2}).`, { name: "SliceOffsetOutOfBoundsError" });
      }
    };
    SizeExceedsPaddingSizeError = class extends BaseError2 {
      constructor({ size: size2, targetSize, type }) {
        super(`${type.charAt(0).toUpperCase()}${type.slice(1).toLowerCase()} size (${size2}) exceeds padding size (${targetSize}).`, { name: "SizeExceedsPaddingSizeError" });
      }
    };
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/data/pad.js
function pad(hexOrBytes, { dir, size: size2 = 32 } = {}) {
  if (typeof hexOrBytes === "string")
    return padHex(hexOrBytes, { dir, size: size2 });
  return padBytes(hexOrBytes, { dir, size: size2 });
}
function padHex(hex_, { dir, size: size2 = 32 } = {}) {
  if (size2 === null)
    return hex_;
  const hex = hex_.replace("0x", "");
  if (hex.length > size2 * 2)
    throw new SizeExceedsPaddingSizeError({
      size: Math.ceil(hex.length / 2),
      targetSize: size2,
      type: "hex"
    });
  return `0x${hex[dir === "right" ? "padEnd" : "padStart"](size2 * 2, "0")}`;
}
function padBytes(bytes, { dir, size: size2 = 32 } = {}) {
  if (size2 === null)
    return bytes;
  if (bytes.length > size2)
    throw new SizeExceedsPaddingSizeError({
      size: bytes.length,
      targetSize: size2,
      type: "bytes"
    });
  const paddedBytes = new Uint8Array(size2);
  for (let i = 0; i < size2; i++) {
    const padEnd = dir === "right";
    paddedBytes[padEnd ? i : size2 - i - 1] = bytes[padEnd ? i : bytes.length - i - 1];
  }
  return paddedBytes;
}
var init_pad = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/data/pad.js"() {
    init_data();
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/errors/encoding.js
var IntegerOutOfRangeError, InvalidBytesBooleanError, SizeOverflowError;
var init_encoding = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/errors/encoding.js"() {
    init_base();
    IntegerOutOfRangeError = class extends BaseError2 {
      constructor({ max, min, signed, size: size2, value }) {
        super(`Number "${value}" is not in safe ${size2 ? `${size2 * 8}-bit ${signed ? "signed" : "unsigned"} ` : ""}integer range ${max ? `(${min} to ${max})` : `(above ${min})`}`, { name: "IntegerOutOfRangeError" });
      }
    };
    InvalidBytesBooleanError = class extends BaseError2 {
      constructor(bytes) {
        super(`Bytes value "${bytes}" is not a valid boolean. The bytes array must contain a single byte of either a 0 or 1 value.`, {
          name: "InvalidBytesBooleanError"
        });
      }
    };
    SizeOverflowError = class extends BaseError2 {
      constructor({ givenSize, maxSize }) {
        super(`Size cannot exceed ${maxSize} bytes. Given size: ${givenSize} bytes.`, { name: "SizeOverflowError" });
      }
    };
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/data/trim.js
function trim(hexOrBytes, { dir = "left" } = {}) {
  let data = typeof hexOrBytes === "string" ? hexOrBytes.replace("0x", "") : hexOrBytes;
  let sliceLength = 0;
  for (let i = 0; i < data.length - 1; i++) {
    if (data[dir === "left" ? i : data.length - i - 1].toString() === "0")
      sliceLength++;
    else
      break;
  }
  data = dir === "left" ? data.slice(sliceLength) : data.slice(0, data.length - sliceLength);
  if (typeof hexOrBytes === "string") {
    if (data.length === 1 && dir === "right")
      data = `${data}0`;
    return `0x${data.length % 2 === 1 ? `0${data}` : data}`;
  }
  return data;
}
var init_trim = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/data/trim.js"() {
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/encoding/fromHex.js
function assertSize(hexOrBytes, { size: size2 }) {
  if (size(hexOrBytes) > size2)
    throw new SizeOverflowError({
      givenSize: size(hexOrBytes),
      maxSize: size2
    });
}
function hexToBigInt(hex, opts = {}) {
  const { signed } = opts;
  if (opts.size)
    assertSize(hex, { size: opts.size });
  const value = BigInt(hex);
  if (!signed)
    return value;
  const size2 = (hex.length - 2) / 2;
  const max = (1n << BigInt(size2) * 8n - 1n) - 1n;
  if (value <= max)
    return value;
  return value - BigInt(`0x${"f".padStart(size2 * 2, "f")}`) - 1n;
}
function hexToNumber(hex, opts = {}) {
  const value = hexToBigInt(hex, opts);
  const number = Number(value);
  if (!Number.isSafeInteger(number))
    throw new IntegerOutOfRangeError({
      max: `${Number.MAX_SAFE_INTEGER}`,
      min: `${Number.MIN_SAFE_INTEGER}`,
      signed: opts.signed,
      size: opts.size,
      value: `${value}n`
    });
  return number;
}
var init_fromHex = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/encoding/fromHex.js"() {
    init_encoding();
    init_size();
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/encoding/toHex.js
function toHex(value, opts = {}) {
  if (typeof value === "number" || typeof value === "bigint")
    return numberToHex(value, opts);
  if (typeof value === "string") {
    return stringToHex(value, opts);
  }
  if (typeof value === "boolean")
    return boolToHex(value, opts);
  return bytesToHex(value, opts);
}
function boolToHex(value, opts = {}) {
  const hex = `0x${Number(value)}`;
  if (typeof opts.size === "number") {
    assertSize(hex, { size: opts.size });
    return pad(hex, { size: opts.size });
  }
  return hex;
}
function bytesToHex(value, opts = {}) {
  let string = "";
  for (let i = 0; i < value.length; i++) {
    string += hexes[value[i]];
  }
  const hex = `0x${string}`;
  if (typeof opts.size === "number") {
    assertSize(hex, { size: opts.size });
    return pad(hex, { dir: "right", size: opts.size });
  }
  return hex;
}
function numberToHex(value_, opts = {}) {
  const { signed, size: size2 } = opts;
  const value = BigInt(value_);
  let maxValue;
  if (size2) {
    if (signed)
      maxValue = (1n << BigInt(size2) * 8n - 1n) - 1n;
    else
      maxValue = 2n ** (BigInt(size2) * 8n) - 1n;
  } else if (typeof value_ === "number") {
    maxValue = BigInt(Number.MAX_SAFE_INTEGER);
  }
  const minValue = typeof maxValue === "bigint" && signed ? -maxValue - 1n : 0;
  if (maxValue && value > maxValue || value < minValue) {
    const suffix = typeof value_ === "bigint" ? "n" : "";
    throw new IntegerOutOfRangeError({
      max: maxValue ? `${maxValue}${suffix}` : void 0,
      min: `${minValue}${suffix}`,
      signed,
      size: size2,
      value: `${value_}${suffix}`
    });
  }
  const hex = `0x${(signed && value < 0 ? (1n << BigInt(size2 * 8)) + BigInt(value) : value).toString(16)}`;
  if (size2)
    return pad(hex, { size: size2 });
  return hex;
}
function stringToHex(value_, opts = {}) {
  const value = encoder.encode(value_);
  return bytesToHex(value, opts);
}
var hexes, encoder;
var init_toHex = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/encoding/toHex.js"() {
    init_encoding();
    init_pad();
    init_fromHex();
    hexes = /* @__PURE__ */ Array.from({ length: 256 }, (_v, i) => i.toString(16).padStart(2, "0"));
    encoder = /* @__PURE__ */ new TextEncoder();
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/encoding/toBytes.js
function toBytes(value, opts = {}) {
  if (typeof value === "number" || typeof value === "bigint")
    return numberToBytes(value, opts);
  if (typeof value === "boolean")
    return boolToBytes(value, opts);
  if (isHex(value))
    return hexToBytes(value, opts);
  return stringToBytes(value, opts);
}
function boolToBytes(value, opts = {}) {
  const bytes = new Uint8Array(1);
  bytes[0] = Number(value);
  if (typeof opts.size === "number") {
    assertSize(bytes, { size: opts.size });
    return pad(bytes, { size: opts.size });
  }
  return bytes;
}
function charCodeToBase16(char) {
  if (char >= charCodeMap.zero && char <= charCodeMap.nine)
    return char - charCodeMap.zero;
  if (char >= charCodeMap.A && char <= charCodeMap.F)
    return char - (charCodeMap.A - 10);
  if (char >= charCodeMap.a && char <= charCodeMap.f)
    return char - (charCodeMap.a - 10);
  return void 0;
}
function hexToBytes(hex_, opts = {}) {
  let hex = hex_;
  if (opts.size) {
    assertSize(hex, { size: opts.size });
    hex = pad(hex, { dir: "right", size: opts.size });
  }
  let hexString = hex.slice(2);
  if (hexString.length % 2)
    hexString = `0${hexString}`;
  const length = hexString.length / 2;
  const bytes = new Uint8Array(length);
  for (let index = 0, j = 0; index < length; index++) {
    const nibbleLeft = charCodeToBase16(hexString.charCodeAt(j++));
    const nibbleRight = charCodeToBase16(hexString.charCodeAt(j++));
    if (nibbleLeft === void 0 || nibbleRight === void 0) {
      throw new BaseError2(`Invalid byte sequence ("${hexString[j - 2]}${hexString[j - 1]}" in "${hexString}").`);
    }
    bytes[index] = nibbleLeft * 16 + nibbleRight;
  }
  return bytes;
}
function numberToBytes(value, opts) {
  const hex = numberToHex(value, opts);
  return hexToBytes(hex);
}
function stringToBytes(value, opts = {}) {
  const bytes = encoder2.encode(value);
  if (typeof opts.size === "number") {
    assertSize(bytes, { size: opts.size });
    return pad(bytes, { dir: "right", size: opts.size });
  }
  return bytes;
}
var encoder2, charCodeMap;
var init_toBytes = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/encoding/toBytes.js"() {
    init_base();
    init_isHex();
    init_pad();
    init_fromHex();
    init_toHex();
    encoder2 = /* @__PURE__ */ new TextEncoder();
    charCodeMap = {
      zero: 48,
      nine: 57,
      A: 65,
      F: 70,
      a: 97,
      f: 102
    };
  }
});

// ../hoodstonk/app/node_modules/@noble/hashes/esm/_u64.js
function fromBig(n, le = false) {
  if (le)
    return { h: Number(n & U32_MASK64), l: Number(n >> _32n & U32_MASK64) };
  return { h: Number(n >> _32n & U32_MASK64) | 0, l: Number(n & U32_MASK64) | 0 };
}
function split(lst, le = false) {
  const len = lst.length;
  let Ah = new Uint32Array(len);
  let Al = new Uint32Array(len);
  for (let i = 0; i < len; i++) {
    const { h, l } = fromBig(lst[i], le);
    [Ah[i], Al[i]] = [h, l];
  }
  return [Ah, Al];
}
var U32_MASK64, _32n, rotlSH, rotlSL, rotlBH, rotlBL;
var init_u64 = __esm({
  "../hoodstonk/app/node_modules/@noble/hashes/esm/_u64.js"() {
    U32_MASK64 = /* @__PURE__ */ BigInt(2 ** 32 - 1);
    _32n = /* @__PURE__ */ BigInt(32);
    rotlSH = (h, l, s) => h << s | l >>> 32 - s;
    rotlSL = (h, l, s) => l << s | h >>> 32 - s;
    rotlBH = (h, l, s) => l << s - 32 | h >>> 64 - s;
    rotlBL = (h, l, s) => h << s - 32 | l >>> 64 - s;
  }
});

// ../hoodstonk/app/node_modules/@noble/hashes/esm/utils.js
function isBytes(a) {
  return a instanceof Uint8Array || ArrayBuffer.isView(a) && a.constructor.name === "Uint8Array";
}
function anumber(n) {
  if (!Number.isSafeInteger(n) || n < 0)
    throw new Error("positive integer expected, got " + n);
}
function abytes(b, ...lengths) {
  if (!isBytes(b))
    throw new Error("Uint8Array expected");
  if (lengths.length > 0 && !lengths.includes(b.length))
    throw new Error("Uint8Array expected of length " + lengths + ", got length=" + b.length);
}
function aexists(instance, checkFinished = true) {
  if (instance.destroyed)
    throw new Error("Hash instance has been destroyed");
  if (checkFinished && instance.finished)
    throw new Error("Hash#digest() has already been called");
}
function aoutput(out, instance) {
  abytes(out);
  const min = instance.outputLen;
  if (out.length < min) {
    throw new Error("digestInto() expects output buffer of length at least " + min);
  }
}
function u32(arr) {
  return new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
}
function clean(...arrays) {
  for (let i = 0; i < arrays.length; i++) {
    arrays[i].fill(0);
  }
}
function byteSwap(word) {
  return word << 24 & 4278190080 | word << 8 & 16711680 | word >>> 8 & 65280 | word >>> 24 & 255;
}
function byteSwap32(arr) {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = byteSwap(arr[i]);
  }
  return arr;
}
function utf8ToBytes(str) {
  if (typeof str !== "string")
    throw new Error("string expected");
  return new Uint8Array(new TextEncoder().encode(str));
}
function toBytes2(data) {
  if (typeof data === "string")
    data = utf8ToBytes(data);
  abytes(data);
  return data;
}
function createHasher(hashCons) {
  const hashC = (msg) => hashCons().update(toBytes2(msg)).digest();
  const tmp = hashCons();
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = () => hashCons();
  return hashC;
}
var isLE, swap32IfBE, Hash;
var init_utils2 = __esm({
  "../hoodstonk/app/node_modules/@noble/hashes/esm/utils.js"() {
    isLE = /* @__PURE__ */ (() => new Uint8Array(new Uint32Array([287454020]).buffer)[0] === 68)();
    swap32IfBE = isLE ? (u) => u : byteSwap32;
    Hash = class {
    };
  }
});

// ../hoodstonk/app/node_modules/@noble/hashes/esm/sha3.js
function keccakP(s, rounds = 24) {
  const B = new Uint32Array(5 * 2);
  for (let round = 24 - rounds; round < 24; round++) {
    for (let x = 0; x < 10; x++)
      B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
    for (let x = 0; x < 10; x += 2) {
      const idx1 = (x + 8) % 10;
      const idx0 = (x + 2) % 10;
      const B0 = B[idx0];
      const B1 = B[idx0 + 1];
      const Th = rotlH(B0, B1, 1) ^ B[idx1];
      const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
      for (let y = 0; y < 50; y += 10) {
        s[x + y] ^= Th;
        s[x + y + 1] ^= Tl;
      }
    }
    let curH = s[2];
    let curL = s[3];
    for (let t = 0; t < 24; t++) {
      const shift = SHA3_ROTL[t];
      const Th = rotlH(curH, curL, shift);
      const Tl = rotlL(curH, curL, shift);
      const PI = SHA3_PI[t];
      curH = s[PI];
      curL = s[PI + 1];
      s[PI] = Th;
      s[PI + 1] = Tl;
    }
    for (let y = 0; y < 50; y += 10) {
      for (let x = 0; x < 10; x++)
        B[x] = s[y + x];
      for (let x = 0; x < 10; x++)
        s[y + x] ^= ~B[(x + 2) % 10] & B[(x + 4) % 10];
    }
    s[0] ^= SHA3_IOTA_H[round];
    s[1] ^= SHA3_IOTA_L[round];
  }
  clean(B);
}
var _0n, _1n, _2n, _7n, _256n, _0x71n, SHA3_PI, SHA3_ROTL, _SHA3_IOTA, IOTAS, SHA3_IOTA_H, SHA3_IOTA_L, rotlH, rotlL, Keccak, gen, keccak_256;
var init_sha3 = __esm({
  "../hoodstonk/app/node_modules/@noble/hashes/esm/sha3.js"() {
    init_u64();
    init_utils2();
    _0n = BigInt(0);
    _1n = BigInt(1);
    _2n = BigInt(2);
    _7n = BigInt(7);
    _256n = BigInt(256);
    _0x71n = BigInt(113);
    SHA3_PI = [];
    SHA3_ROTL = [];
    _SHA3_IOTA = [];
    for (let round = 0, R = _1n, x = 1, y = 0; round < 24; round++) {
      [x, y] = [y, (2 * x + 3 * y) % 5];
      SHA3_PI.push(2 * (5 * y + x));
      SHA3_ROTL.push((round + 1) * (round + 2) / 2 % 64);
      let t = _0n;
      for (let j = 0; j < 7; j++) {
        R = (R << _1n ^ (R >> _7n) * _0x71n) % _256n;
        if (R & _2n)
          t ^= _1n << (_1n << /* @__PURE__ */ BigInt(j)) - _1n;
      }
      _SHA3_IOTA.push(t);
    }
    IOTAS = split(_SHA3_IOTA, true);
    SHA3_IOTA_H = IOTAS[0];
    SHA3_IOTA_L = IOTAS[1];
    rotlH = (h, l, s) => s > 32 ? rotlBH(h, l, s) : rotlSH(h, l, s);
    rotlL = (h, l, s) => s > 32 ? rotlBL(h, l, s) : rotlSL(h, l, s);
    Keccak = class _Keccak extends Hash {
      // NOTE: we accept arguments in bytes instead of bits here.
      constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
        super();
        this.pos = 0;
        this.posOut = 0;
        this.finished = false;
        this.destroyed = false;
        this.enableXOF = false;
        this.blockLen = blockLen;
        this.suffix = suffix;
        this.outputLen = outputLen;
        this.enableXOF = enableXOF;
        this.rounds = rounds;
        anumber(outputLen);
        if (!(0 < blockLen && blockLen < 200))
          throw new Error("only keccak-f1600 function is supported");
        this.state = new Uint8Array(200);
        this.state32 = u32(this.state);
      }
      clone() {
        return this._cloneInto();
      }
      keccak() {
        swap32IfBE(this.state32);
        keccakP(this.state32, this.rounds);
        swap32IfBE(this.state32);
        this.posOut = 0;
        this.pos = 0;
      }
      update(data) {
        aexists(this);
        data = toBytes2(data);
        abytes(data);
        const { blockLen, state } = this;
        const len = data.length;
        for (let pos = 0; pos < len; ) {
          const take = Math.min(blockLen - this.pos, len - pos);
          for (let i = 0; i < take; i++)
            state[this.pos++] ^= data[pos++];
          if (this.pos === blockLen)
            this.keccak();
        }
        return this;
      }
      finish() {
        if (this.finished)
          return;
        this.finished = true;
        const { state, suffix, pos, blockLen } = this;
        state[pos] ^= suffix;
        if ((suffix & 128) !== 0 && pos === blockLen - 1)
          this.keccak();
        state[blockLen - 1] ^= 128;
        this.keccak();
      }
      writeInto(out) {
        aexists(this, false);
        abytes(out);
        this.finish();
        const bufferOut = this.state;
        const { blockLen } = this;
        for (let pos = 0, len = out.length; pos < len; ) {
          if (this.posOut >= blockLen)
            this.keccak();
          const take = Math.min(blockLen - this.posOut, len - pos);
          out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
          this.posOut += take;
          pos += take;
        }
        return out;
      }
      xofInto(out) {
        if (!this.enableXOF)
          throw new Error("XOF is not possible for this instance");
        return this.writeInto(out);
      }
      xof(bytes) {
        anumber(bytes);
        return this.xofInto(new Uint8Array(bytes));
      }
      digestInto(out) {
        aoutput(out, this);
        if (this.finished)
          throw new Error("digest() was already called");
        this.writeInto(out);
        this.destroy();
        return out;
      }
      digest() {
        return this.digestInto(new Uint8Array(this.outputLen));
      }
      destroy() {
        this.destroyed = true;
        clean(this.state);
      }
      _cloneInto(to) {
        const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
        to || (to = new _Keccak(blockLen, suffix, outputLen, enableXOF, rounds));
        to.state32.set(this.state32);
        to.pos = this.pos;
        to.posOut = this.posOut;
        to.finished = this.finished;
        to.rounds = rounds;
        to.suffix = suffix;
        to.outputLen = outputLen;
        to.enableXOF = enableXOF;
        to.destroyed = this.destroyed;
        return to;
      }
    };
    gen = (suffix, blockLen, outputLen) => createHasher(() => new Keccak(blockLen, suffix, outputLen));
    keccak_256 = /* @__PURE__ */ (() => gen(1, 136, 256 / 8))();
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/hash/keccak256.js
function keccak256(value, to_) {
  const to = to_ || "hex";
  const bytes = keccak_256(isHex(value, { strict: false }) ? toBytes(value) : value);
  if (to === "bytes")
    return bytes;
  return toHex(bytes);
}
var init_keccak256 = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/hash/keccak256.js"() {
    init_sha3();
    init_isHex();
    init_toBytes();
    init_toHex();
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/hash/hashSignature.js
function hashSignature(sig) {
  return hash(sig);
}
var hash;
var init_hashSignature = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/hash/hashSignature.js"() {
    init_toBytes();
    init_keccak256();
    hash = (value) => keccak256(toBytes(value));
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/hash/normalizeSignature.js
function normalizeSignature(signature) {
  let active = true;
  let current = "";
  let level = 0;
  let result = "";
  let valid = false;
  for (let i = 0; i < signature.length; i++) {
    const char = signature[i];
    if (["(", ")", ","].includes(char))
      active = true;
    if (char === "(")
      level++;
    if (char === ")")
      level--;
    if (!active)
      continue;
    if (level === 0) {
      if (char === " " && ["event", "function", ""].includes(result))
        result = "";
      else {
        result += char;
        if (char === ")") {
          valid = true;
          break;
        }
      }
      continue;
    }
    if (char === " ") {
      if (signature[i - 1] !== "," && current !== "," && current !== ",(") {
        current = "";
        active = false;
      }
      continue;
    }
    result += char;
    current += char;
  }
  if (!valid)
    throw new BaseError2("Unable to normalize signature.");
  return result;
}
var init_normalizeSignature = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/hash/normalizeSignature.js"() {
    init_base();
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/hash/toSignature.js
var toSignature;
var init_toSignature = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/hash/toSignature.js"() {
    init_exports();
    init_normalizeSignature();
    toSignature = (def) => {
      const def_ = (() => {
        if (typeof def === "string")
          return def;
        return formatAbiItem(def);
      })();
      return normalizeSignature(def_);
    };
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/hash/toSignatureHash.js
function toSignatureHash(fn) {
  return hashSignature(toSignature(fn));
}
var init_toSignatureHash = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/hash/toSignatureHash.js"() {
    init_hashSignature();
    init_toSignature();
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/hash/toEventSelector.js
var toEventSelector;
var init_toEventSelector = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/hash/toEventSelector.js"() {
    init_toSignatureHash();
    toEventSelector = toSignatureHash;
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/errors/address.js
var InvalidAddressError;
var init_address = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/errors/address.js"() {
    init_base();
    InvalidAddressError = class extends BaseError2 {
      constructor({ address }) {
        super(`Address "${address}" is invalid.`, {
          metaMessages: [
            "- Address must be a hex value of 20 bytes (40 hex characters).",
            "- Address must match its checksum counterpart."
          ],
          name: "InvalidAddressError"
        });
      }
    };
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/lru.js
var LruMap;
var init_lru = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/lru.js"() {
    LruMap = class extends Map {
      constructor(size2) {
        super();
        Object.defineProperty(this, "maxSize", {
          enumerable: true,
          configurable: true,
          writable: true,
          value: void 0
        });
        this.maxSize = size2;
      }
      get(key) {
        const value = super.get(key);
        if (super.has(key)) {
          super.delete(key);
          super.set(key, value);
        }
        return value;
      }
      set(key, value) {
        if (super.has(key))
          super.delete(key);
        super.set(key, value);
        if (this.maxSize && this.size > this.maxSize) {
          const firstKey = super.keys().next().value;
          if (firstKey !== void 0)
            super.delete(firstKey);
        }
        return this;
      }
    };
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/address/getAddress.js
function checksumAddress(address_, chainId) {
  if (checksumAddressCache.has(`${address_}.${chainId}`))
    return checksumAddressCache.get(`${address_}.${chainId}`);
  const hexAddress = chainId ? `${chainId}${address_.toLowerCase()}` : address_.substring(2).toLowerCase();
  const hash2 = keccak256(stringToBytes(hexAddress), "bytes");
  const address = (chainId ? hexAddress.substring(`${chainId}0x`.length) : hexAddress).split("");
  for (let i = 0; i < 40; i += 2) {
    if (hash2[i >> 1] >> 4 >= 8 && address[i]) {
      address[i] = address[i].toUpperCase();
    }
    if ((hash2[i >> 1] & 15) >= 8 && address[i + 1]) {
      address[i + 1] = address[i + 1].toUpperCase();
    }
  }
  const result = `0x${address.join("")}`;
  checksumAddressCache.set(`${address_}.${chainId}`, result);
  return result;
}
var checksumAddressCache;
var init_getAddress = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/address/getAddress.js"() {
    init_toBytes();
    init_keccak256();
    init_lru();
    checksumAddressCache = /* @__PURE__ */ new LruMap(8192);
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/address/isAddress.js
function isAddress(address, options) {
  const { strict = true } = options ?? {};
  const cacheKey = `${address}.${strict}`;
  if (isAddressCache.has(cacheKey))
    return isAddressCache.get(cacheKey);
  const result = (() => {
    if (!addressRegex.test(address))
      return false;
    if (address.toLowerCase() === address)
      return true;
    if (strict)
      return checksumAddress(address) === address;
    return true;
  })();
  isAddressCache.set(cacheKey, result);
  return result;
}
var addressRegex, isAddressCache;
var init_isAddress = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/address/isAddress.js"() {
    init_lru();
    init_getAddress();
    addressRegex = /^0x[a-fA-F0-9]{40}$/;
    isAddressCache = /* @__PURE__ */ new LruMap(8192);
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/data/concat.js
function concatHex(values) {
  return `0x${values.reduce((acc, x) => acc + x.replace("0x", ""), "")}`;
}
var init_concat = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/data/concat.js"() {
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/data/slice.js
function slice(value, start, end, { strict } = {}) {
  if (isHex(value, { strict: false }))
    return sliceHex(value, start, end, {
      strict
    });
  return sliceBytes(value, start, end, {
    strict
  });
}
function assertStartOffset(value, start) {
  if (typeof start === "number" && start > 0 && start > size(value) - 1)
    throw new SliceOffsetOutOfBoundsError({
      offset: start,
      position: "start",
      size: size(value)
    });
}
function assertEndOffset(value, start, end) {
  if (typeof start === "number" && typeof end === "number" && size(value) !== end - start) {
    throw new SliceOffsetOutOfBoundsError({
      offset: end,
      position: "end",
      size: size(value)
    });
  }
}
function sliceBytes(value_, start, end, { strict } = {}) {
  assertStartOffset(value_, start);
  const value = value_.slice(start, end);
  if (strict)
    assertEndOffset(value, start, end);
  return value;
}
function sliceHex(value_, start, end, { strict } = {}) {
  assertStartOffset(value_, start);
  const value = `0x${value_.replace("0x", "").slice((start ?? 0) * 2, (end ?? value_.length) * 2)}`;
  if (strict)
    assertEndOffset(value, start, end);
  return value;
}
var init_slice = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/data/slice.js"() {
    init_data();
    init_isHex();
    init_size();
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/regex.js
var integerRegex2;
var init_regex2 = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/regex.js"() {
    integerRegex2 = /^(u?int)(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/;
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/abi/encodeAbiParameters.js
function encodeAbiParameters(params, values) {
  if (params.length !== values.length)
    throw new AbiEncodingLengthMismatchError({
      expectedLength: params.length,
      givenLength: values.length
    });
  const preparedParams = prepareParams({
    params,
    values
  });
  return encodeParams(preparedParams);
}
function prepareParams({ params, values }) {
  const preparedParams = [];
  for (let i = 0; i < params.length; i++) {
    preparedParams.push(prepareParam({ param: params[i], value: values[i] }));
  }
  return preparedParams;
}
function prepareParam({ param, value }) {
  const arrayComponents = getArrayComponents(param.type);
  if (arrayComponents) {
    const [length, type] = arrayComponents;
    return encodeArray(value, { length, param: { ...param, type } });
  }
  if (param.type === "tuple") {
    return encodeTuple(value, {
      param
    });
  }
  if (param.type === "address") {
    return encodeAddress(value);
  }
  if (param.type === "bool") {
    return encodeBool(value);
  }
  if (param.type.startsWith("uint") || param.type.startsWith("int")) {
    const signed = param.type.startsWith("int");
    const [, , size2 = "256"] = integerRegex2.exec(param.type) ?? [];
    return encodeNumber(value, {
      signed,
      size: Number(size2)
    });
  }
  if (param.type.startsWith("bytes")) {
    return encodeBytes(value, { param });
  }
  if (param.type === "string") {
    return encodeString(value);
  }
  throw new InvalidAbiEncodingTypeError(param.type, {
    docsPath: "/docs/contract/encodeAbiParameters"
  });
}
function encodeParams(preparedParams) {
  let staticSize = 0;
  for (let i = 0; i < preparedParams.length; i++) {
    const { dynamic, encoded } = preparedParams[i];
    if (dynamic)
      staticSize += 32;
    else
      staticSize += size(encoded);
  }
  const staticParams = [];
  const dynamicParams = [];
  let dynamicSize = 0;
  for (let i = 0; i < preparedParams.length; i++) {
    const { dynamic, encoded } = preparedParams[i];
    if (dynamic) {
      staticParams.push(numberToHex(staticSize + dynamicSize, { size: 32 }));
      dynamicParams.push(encoded);
      dynamicSize += size(encoded);
    } else {
      staticParams.push(encoded);
    }
  }
  return concatHex([...staticParams, ...dynamicParams]);
}
function encodeAddress(value) {
  if (!isAddress(value))
    throw new InvalidAddressError({ address: value });
  return { dynamic: false, encoded: padHex(value.toLowerCase()) };
}
function encodeArray(value, { length, param }) {
  const dynamic = length === null;
  if (!Array.isArray(value))
    throw new InvalidArrayError(value);
  if (!dynamic && value.length !== length)
    throw new AbiEncodingArrayLengthMismatchError({
      expectedLength: length,
      givenLength: value.length,
      type: `${param.type}[${length}]`
    });
  let dynamicChild = value.length === 0 && isDynamicType(param);
  const preparedParams = [];
  for (let i = 0; i < value.length; i++) {
    const preparedParam = prepareParam({ param, value: value[i] });
    if (preparedParam.dynamic)
      dynamicChild = true;
    preparedParams.push(preparedParam);
  }
  if (dynamic || dynamicChild) {
    const data = encodeParams(preparedParams);
    if (dynamic) {
      const length2 = numberToHex(preparedParams.length, { size: 32 });
      return {
        dynamic: true,
        encoded: concatHex([length2, data])
      };
    }
    if (dynamicChild)
      return { dynamic: true, encoded: data };
  }
  return {
    dynamic: false,
    encoded: concatHex(preparedParams.map(({ encoded }) => encoded))
  };
}
function encodeBytes(value, { param }) {
  const [, paramSize] = param.type.split("bytes");
  const bytesSize = size(value);
  if (!paramSize) {
    let value_ = value;
    if (bytesSize % 32 !== 0)
      value_ = padHex(value_, {
        dir: "right",
        size: Math.ceil((value.length - 2) / 2 / 32) * 32
      });
    return {
      dynamic: true,
      encoded: concatHex([
        padHex(numberToHex(bytesSize, { size: 32 })),
        value_
      ])
    };
  }
  if (bytesSize !== Number.parseInt(paramSize, 10))
    throw new AbiEncodingBytesSizeMismatchError({
      expectedSize: Number.parseInt(paramSize, 10),
      value
    });
  return { dynamic: false, encoded: padHex(value, { dir: "right" }) };
}
function encodeBool(value) {
  if (typeof value !== "boolean")
    throw new BaseError2(`Invalid boolean value: "${value}" (type: ${typeof value}). Expected: \`true\` or \`false\`.`);
  return { dynamic: false, encoded: padHex(boolToHex(value)) };
}
function encodeNumber(value, { signed, size: size2 = 256 }) {
  if (typeof size2 === "number") {
    const max = 2n ** (BigInt(size2) - (signed ? 1n : 0n)) - 1n;
    const min = signed ? -max - 1n : 0n;
    if (value > max || value < min)
      throw new IntegerOutOfRangeError({
        max: max.toString(),
        min: min.toString(),
        signed,
        size: size2 / 8,
        value: value.toString()
      });
  }
  return {
    dynamic: false,
    encoded: numberToHex(value, {
      size: 32,
      signed
    })
  };
}
function encodeString(value) {
  const hexValue = stringToHex(value);
  const partsLength = Math.ceil(size(hexValue) / 32);
  const parts = [];
  for (let i = 0; i < partsLength; i++) {
    parts.push(padHex(slice(hexValue, i * 32, (i + 1) * 32), {
      dir: "right"
    }));
  }
  return {
    dynamic: true,
    encoded: concatHex([
      padHex(numberToHex(size(hexValue), { size: 32 })),
      ...parts
    ])
  };
}
function encodeTuple(value, { param }) {
  let dynamic = false;
  const preparedParams = [];
  for (let i = 0; i < param.components.length; i++) {
    const param_ = param.components[i];
    const index = Array.isArray(value) ? i : param_.name;
    const preparedParam = prepareParam({
      param: param_,
      value: value[index]
    });
    preparedParams.push(preparedParam);
    if (preparedParam.dynamic)
      dynamic = true;
  }
  return {
    dynamic,
    encoded: dynamic ? encodeParams(preparedParams) : concatHex(preparedParams.map(({ encoded }) => encoded))
  };
}
function getArrayComponents(type) {
  const matches = type.match(/^(.*)\[(\d+)?\]$/);
  return matches ? (
    // Return `null` if the array is dynamic.
    [matches[2] ? Number(matches[2]) : null, matches[1]]
  ) : void 0;
}
function isDynamicType(param) {
  const { type } = param;
  if (type === "string")
    return true;
  if (type === "bytes")
    return true;
  if (type.endsWith("[]"))
    return true;
  if (type === "tuple")
    return param.components.some(isDynamicType);
  const arrayComponents = getArrayComponents(type);
  if (arrayComponents)
    return isDynamicType({ ...param, type: arrayComponents[1] });
  return false;
}
var init_encodeAbiParameters = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/abi/encodeAbiParameters.js"() {
    init_abi();
    init_address();
    init_base();
    init_encoding();
    init_isAddress();
    init_concat();
    init_pad();
    init_size();
    init_slice();
    init_toHex();
    init_regex2();
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/hash/toFunctionSelector.js
var toFunctionSelector;
var init_toFunctionSelector = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/hash/toFunctionSelector.js"() {
    init_slice();
    init_toSignatureHash();
    toFunctionSelector = (fn) => slice(toSignatureHash(fn), 0, 4);
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/abi/getAbiItem.js
function getAbiItem(parameters) {
  const { abi, args = [], name } = parameters;
  const isSelector = isHex(name, { strict: false });
  const abiItems = abi.filter((abiItem) => {
    if (isSelector) {
      if (abiItem.type === "function")
        return toFunctionSelector(abiItem) === name;
      if (abiItem.type === "event")
        return toEventSelector(abiItem) === name;
      return false;
    }
    return "name" in abiItem && abiItem.name === name;
  });
  if (abiItems.length === 0)
    return void 0;
  if (abiItems.length === 1)
    return abiItems[0];
  let matchedAbiItem;
  for (const abiItem of abiItems) {
    if (!("inputs" in abiItem))
      continue;
    if (!args || args.length === 0) {
      if (!abiItem.inputs || abiItem.inputs.length === 0)
        return abiItem;
      continue;
    }
    if (!abiItem.inputs)
      continue;
    if (abiItem.inputs.length === 0)
      continue;
    if (abiItem.inputs.length !== args.length)
      continue;
    const matched = args.every((arg, index) => {
      const abiParameter = "inputs" in abiItem && abiItem.inputs[index];
      if (!abiParameter)
        return false;
      return isArgOfType(arg, abiParameter);
    });
    if (matched) {
      if (matchedAbiItem && "inputs" in matchedAbiItem && matchedAbiItem.inputs) {
        const ambiguousTypes = getAmbiguousTypes(abiItem.inputs, matchedAbiItem.inputs, args);
        if (ambiguousTypes)
          throw new AbiItemAmbiguityError({
            abiItem,
            type: ambiguousTypes[0]
          }, {
            abiItem: matchedAbiItem,
            type: ambiguousTypes[1]
          });
      }
      matchedAbiItem = abiItem;
    }
  }
  if (matchedAbiItem)
    return matchedAbiItem;
  return abiItems[0];
}
function isArgOfType(arg, abiParameter) {
  const argType = typeof arg;
  const abiParameterType = abiParameter.type;
  switch (abiParameterType) {
    case "address":
      return isAddress(arg, { strict: false });
    case "bool":
      return argType === "boolean";
    case "function":
      return argType === "string";
    case "string":
      return argType === "string";
    default: {
      if (abiParameterType === "tuple" && "components" in abiParameter)
        return Object.values(abiParameter.components).every((component, index) => {
          return argType === "object" && isArgOfType(Object.values(arg)[index], component);
        });
      if (/^u?int(8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?$/.test(abiParameterType))
        return argType === "number" || argType === "bigint";
      if (/^bytes([1-9]|1[0-9]|2[0-9]|3[0-2])?$/.test(abiParameterType))
        return argType === "string" || arg instanceof Uint8Array;
      if (/[a-z]+[1-9]{0,3}(\[[0-9]{0,}\])+$/.test(abiParameterType)) {
        return Array.isArray(arg) && arg.every((x) => isArgOfType(x, {
          ...abiParameter,
          // Pop off `[]` or `[M]` from end of type
          type: abiParameterType.replace(/(\[[0-9]{0,}\])$/, "")
        }));
      }
      return false;
    }
  }
}
function getAmbiguousTypes(sourceParameters, targetParameters, args) {
  for (const parameterIndex in sourceParameters) {
    const sourceParameter = sourceParameters[parameterIndex];
    const targetParameter = targetParameters[parameterIndex];
    if (sourceParameter.type === "tuple" && targetParameter.type === "tuple" && "components" in sourceParameter && "components" in targetParameter)
      return getAmbiguousTypes(sourceParameter.components, targetParameter.components, args[parameterIndex]);
    const types = [sourceParameter.type, targetParameter.type];
    const ambiguous = (() => {
      if (types.includes("address") && types.includes("bytes20"))
        return true;
      if (types.includes("address") && types.includes("string"))
        return isAddress(args[parameterIndex], { strict: false });
      if (types.includes("address") && types.includes("bytes"))
        return isAddress(args[parameterIndex], { strict: false });
      return false;
    })();
    if (ambiguous)
      return types;
  }
  return;
}
var init_getAbiItem = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/abi/getAbiItem.js"() {
    init_abi();
    init_isHex();
    init_isAddress();
    init_toEventSelector();
    init_toFunctionSelector();
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/abi/prepareEncodeFunctionData.js
function prepareEncodeFunctionData(parameters) {
  const { abi, args, functionName } = parameters;
  let abiItem = abi[0];
  if (functionName) {
    const item = getAbiItem({
      abi,
      args,
      name: functionName
    });
    if (!item)
      throw new AbiFunctionNotFoundError(functionName, { docsPath: docsPath2 });
    abiItem = item;
  }
  if (abiItem.type !== "function")
    throw new AbiFunctionNotFoundError(void 0, { docsPath: docsPath2 });
  return {
    abi: [abiItem],
    functionName: toFunctionSelector(formatAbiItem2(abiItem))
  };
}
var docsPath2;
var init_prepareEncodeFunctionData = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/abi/prepareEncodeFunctionData.js"() {
    init_abi();
    init_toFunctionSelector();
    init_formatAbiItem2();
    init_getAbiItem();
    docsPath2 = "/docs/contract/encodeFunctionData";
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/abi/encodeFunctionData.js
function encodeFunctionData(parameters) {
  const { args } = parameters;
  const { abi, functionName } = (() => {
    if (parameters.abi.length === 1 && parameters.functionName?.startsWith("0x"))
      return parameters;
    return prepareEncodeFunctionData(parameters);
  })();
  const abiItem = abi[0];
  const signature = functionName;
  const data = "inputs" in abiItem && abiItem.inputs ? encodeAbiParameters(abiItem.inputs, args ?? []) : void 0;
  return concatHex([signature, data ?? "0x"]);
}
var init_encodeFunctionData = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/abi/encodeFunctionData.js"() {
    init_concat();
    init_encodeAbiParameters();
    init_prepareEncodeFunctionData();
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/errors/cursor.js
var NegativeOffsetError, PositionOutOfBoundsError, RecursiveReadLimitExceededError;
var init_cursor = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/errors/cursor.js"() {
    init_base();
    NegativeOffsetError = class extends BaseError2 {
      constructor({ offset }) {
        super(`Offset \`${offset}\` cannot be negative.`, {
          name: "NegativeOffsetError"
        });
      }
    };
    PositionOutOfBoundsError = class extends BaseError2 {
      constructor({ length, position }) {
        super(`Position \`${position}\` is out of bounds (\`0 < position < ${length}\`).`, { name: "PositionOutOfBoundsError" });
      }
    };
    RecursiveReadLimitExceededError = class extends BaseError2 {
      constructor({ count, limit }) {
        super(`Recursive read limit of \`${limit}\` exceeded (recursive read count: \`${count}\`).`, { name: "RecursiveReadLimitExceededError" });
      }
    };
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/cursor.js
function createCursor(bytes, { recursiveReadLimit = 8192 } = {}) {
  const cursor = Object.create(staticCursor);
  cursor.bytes = bytes;
  cursor.dataView = new DataView(bytes.buffer ?? bytes, bytes.byteOffset, bytes.byteLength);
  cursor.positionReadCount = /* @__PURE__ */ new Map();
  cursor.recursiveReadLimit = recursiveReadLimit;
  return cursor;
}
var staticCursor;
var init_cursor2 = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/cursor.js"() {
    init_cursor();
    staticCursor = {
      bytes: new Uint8Array(),
      dataView: new DataView(new ArrayBuffer(0)),
      position: 0,
      positionReadCount: /* @__PURE__ */ new Map(),
      recursiveReadCount: 0,
      recursiveReadLimit: Number.POSITIVE_INFINITY,
      assertReadLimit() {
        if (this.recursiveReadCount >= this.recursiveReadLimit)
          throw new RecursiveReadLimitExceededError({
            count: this.recursiveReadCount + 1,
            limit: this.recursiveReadLimit
          });
      },
      assertPosition(position) {
        if (position < 0 || position > this.bytes.length - 1)
          throw new PositionOutOfBoundsError({
            length: this.bytes.length,
            position
          });
      },
      decrementPosition(offset) {
        if (offset < 0)
          throw new NegativeOffsetError({ offset });
        const position = this.position - offset;
        this.assertPosition(position);
        this.position = position;
      },
      getReadCount(position) {
        return this.positionReadCount.get(position || this.position) || 0;
      },
      incrementPosition(offset) {
        if (offset < 0)
          throw new NegativeOffsetError({ offset });
        const position = this.position + offset;
        this.assertPosition(position);
        this.position = position;
      },
      inspectByte(position_) {
        const position = position_ ?? this.position;
        this.assertPosition(position);
        return this.bytes[position];
      },
      inspectBytes(length, position_) {
        const position = position_ ?? this.position;
        this.assertPosition(position + length - 1);
        return this.bytes.subarray(position, position + length);
      },
      inspectUint8(position_) {
        const position = position_ ?? this.position;
        this.assertPosition(position);
        return this.bytes[position];
      },
      inspectUint16(position_) {
        const position = position_ ?? this.position;
        this.assertPosition(position + 1);
        return this.dataView.getUint16(position);
      },
      inspectUint24(position_) {
        const position = position_ ?? this.position;
        this.assertPosition(position + 2);
        return (this.dataView.getUint16(position) << 8) + this.dataView.getUint8(position + 2);
      },
      inspectUint32(position_) {
        const position = position_ ?? this.position;
        this.assertPosition(position + 3);
        return this.dataView.getUint32(position);
      },
      pushByte(byte) {
        this.assertPosition(this.position);
        this.bytes[this.position] = byte;
        this.position++;
      },
      pushBytes(bytes) {
        this.assertPosition(this.position + bytes.length - 1);
        this.bytes.set(bytes, this.position);
        this.position += bytes.length;
      },
      pushUint8(value) {
        this.assertPosition(this.position);
        this.bytes[this.position] = value;
        this.position++;
      },
      pushUint16(value) {
        this.assertPosition(this.position + 1);
        this.dataView.setUint16(this.position, value);
        this.position += 2;
      },
      pushUint24(value) {
        this.assertPosition(this.position + 2);
        this.dataView.setUint16(this.position, value >> 8);
        this.dataView.setUint8(this.position + 2, value & ~4294967040);
        this.position += 3;
      },
      pushUint32(value) {
        this.assertPosition(this.position + 3);
        this.dataView.setUint32(this.position, value);
        this.position += 4;
      },
      readByte() {
        this.assertReadLimit();
        this._touch();
        const value = this.inspectByte();
        this.position++;
        return value;
      },
      readBytes(length, size2) {
        this.assertReadLimit();
        this._touch();
        const value = this.inspectBytes(length);
        this.position += size2 ?? length;
        return value;
      },
      readUint8() {
        this.assertReadLimit();
        this._touch();
        const value = this.inspectUint8();
        this.position += 1;
        return value;
      },
      readUint16() {
        this.assertReadLimit();
        this._touch();
        const value = this.inspectUint16();
        this.position += 2;
        return value;
      },
      readUint24() {
        this.assertReadLimit();
        this._touch();
        const value = this.inspectUint24();
        this.position += 3;
        return value;
      },
      readUint32() {
        this.assertReadLimit();
        this._touch();
        const value = this.inspectUint32();
        this.position += 4;
        return value;
      },
      get remaining() {
        return this.bytes.length - this.position;
      },
      setPosition(position) {
        const oldPosition = this.position;
        this.assertPosition(position);
        this.position = position;
        return () => this.position = oldPosition;
      },
      _touch() {
        if (this.recursiveReadLimit === Number.POSITIVE_INFINITY)
          return;
        const count = this.getReadCount();
        this.positionReadCount.set(this.position, count + 1);
        if (count > 0)
          this.recursiveReadCount++;
      }
    };
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/encoding/fromBytes.js
function bytesToBigInt(bytes, opts = {}) {
  if (typeof opts.size !== "undefined")
    assertSize(bytes, { size: opts.size });
  const hex = bytesToHex(bytes);
  return hexToBigInt(hex, opts);
}
function bytesToBool(bytes_, opts = {}) {
  let bytes = bytes_;
  if (typeof opts.size !== "undefined") {
    assertSize(bytes, { size: opts.size });
    bytes = trim(bytes);
  }
  if (bytes.length > 1 || bytes[0] > 1)
    throw new InvalidBytesBooleanError(bytes);
  return Boolean(bytes[0]);
}
function bytesToNumber(bytes, opts = {}) {
  if (typeof opts.size !== "undefined")
    assertSize(bytes, { size: opts.size });
  const hex = bytesToHex(bytes);
  return hexToNumber(hex, opts);
}
function bytesToString(bytes_, opts = {}) {
  let bytes = bytes_;
  if (typeof opts.size !== "undefined") {
    assertSize(bytes, { size: opts.size });
    bytes = trim(bytes, { dir: "right" });
  }
  return new TextDecoder().decode(bytes);
}
var init_fromBytes = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/encoding/fromBytes.js"() {
    init_encoding();
    init_trim();
    init_fromHex();
    init_toHex();
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/abi/decodeAbiParameters.js
function decodeAbiParameters(params, data) {
  const bytes = typeof data === "string" ? hexToBytes(data) : data;
  const cursor = createCursor(bytes);
  if (size(bytes) === 0 && params.length > 0)
    throw new AbiDecodingZeroDataError();
  if (size(data) && size(data) < 32)
    throw new AbiDecodingDataSizeTooSmallError({
      data: typeof data === "string" ? data : bytesToHex(data),
      params,
      size: size(data)
    });
  let consumed = 0;
  const values = [];
  for (let i = 0; i < params.length; ++i) {
    const param = params[i];
    if (consumed < bytes.length)
      cursor.setPosition(consumed);
    const [data2, consumed_] = decodeParameter(cursor, param, {
      staticPosition: 0
    });
    consumed += consumed_;
    values.push(data2);
  }
  return values;
}
function decodeParameter(cursor, param, { staticPosition }) {
  const arrayComponents = getArrayComponents(param.type);
  if (arrayComponents) {
    const [length, type] = arrayComponents;
    return decodeArray(cursor, { ...param, type }, { length, staticPosition });
  }
  if (param.type === "tuple")
    return decodeTuple(cursor, param, { staticPosition });
  if (param.type === "address")
    return decodeAddress(cursor);
  if (param.type === "bool")
    return decodeBool(cursor);
  if (param.type.startsWith("bytes"))
    return decodeBytes(cursor, param, { staticPosition });
  if (param.type.startsWith("uint") || param.type.startsWith("int"))
    return decodeNumber(cursor, param);
  if (param.type === "string")
    return decodeString(cursor, { staticPosition });
  throw new InvalidAbiDecodingTypeError(param.type, {
    docsPath: "/docs/contract/decodeAbiParameters"
  });
}
function decodeAddress(cursor) {
  const value = cursor.readBytes(32);
  return [checksumAddress(bytesToHex(sliceBytes(value, -20))), 32];
}
function decodeArray(cursor, param, { length, staticPosition }) {
  if (length === null) {
    const offset = bytesToNumber(cursor.readBytes(sizeOfOffset));
    const start = staticPosition + offset;
    const startOfData = start + sizeOfLength;
    cursor.setPosition(start);
    const length2 = bytesToNumber(cursor.readBytes(sizeOfLength));
    const dynamicChild = hasDynamicChild(param);
    let consumed2 = 0;
    const value2 = [];
    for (let i = 0; i < length2; ++i) {
      cursor.setPosition(startOfData + (dynamicChild ? i * 32 : consumed2));
      const [data, consumed_] = decodeParameter(cursor, param, {
        staticPosition: startOfData
      });
      consumed2 += consumed_;
      value2.push(data);
      if (consumed_ === 0) {
        cursor.assertReadLimit();
        cursor._touch();
      }
    }
    cursor.setPosition(staticPosition + 32);
    return [value2, 32];
  }
  if (hasDynamicChild(param)) {
    const offset = bytesToNumber(cursor.readBytes(sizeOfOffset));
    const start = staticPosition + offset;
    const value2 = [];
    for (let i = 0; i < length; ++i) {
      cursor.setPosition(start + i * 32);
      const [data] = decodeParameter(cursor, param, {
        staticPosition: start
      });
      value2.push(data);
    }
    cursor.setPosition(staticPosition + 32);
    return [value2, 32];
  }
  let consumed = 0;
  const value = [];
  for (let i = 0; i < length; ++i) {
    const [data, consumed_] = decodeParameter(cursor, param, {
      staticPosition: staticPosition + consumed
    });
    consumed += consumed_;
    value.push(data);
    if (consumed_ === 0) {
      cursor.assertReadLimit();
      cursor._touch();
    }
  }
  return [value, consumed];
}
function decodeBool(cursor) {
  return [bytesToBool(cursor.readBytes(32), { size: 32 }), 32];
}
function decodeBytes(cursor, param, { staticPosition }) {
  const [_, size2] = param.type.split("bytes");
  if (!size2) {
    const offset = bytesToNumber(cursor.readBytes(32));
    cursor.setPosition(staticPosition + offset);
    const length = bytesToNumber(cursor.readBytes(32));
    if (length === 0) {
      cursor.setPosition(staticPosition + 32);
      return ["0x", 32];
    }
    const data = cursor.readBytes(length);
    cursor.setPosition(staticPosition + 32);
    return [bytesToHex(data), 32];
  }
  const value = bytesToHex(cursor.readBytes(Number.parseInt(size2, 10), 32));
  return [value, 32];
}
function decodeNumber(cursor, param) {
  const signed = param.type.startsWith("int");
  const size2 = Number.parseInt(param.type.split("int")[1] || "256", 10);
  const value = cursor.readBytes(32);
  return [
    size2 > 48 ? bytesToBigInt(value, { signed }) : bytesToNumber(value, { signed }),
    32
  ];
}
function decodeTuple(cursor, param, { staticPosition }) {
  const hasUnnamedChild = param.components.length === 0 || param.components.some(({ name }) => !name);
  const value = hasUnnamedChild ? [] : {};
  let consumed = 0;
  if (hasDynamicChild(param)) {
    const offset = bytesToNumber(cursor.readBytes(sizeOfOffset));
    const start = staticPosition + offset;
    for (let i = 0; i < param.components.length; ++i) {
      const component = param.components[i];
      cursor.setPosition(start + consumed);
      const [data, consumed_] = decodeParameter(cursor, component, {
        staticPosition: start
      });
      consumed += consumed_;
      value[hasUnnamedChild ? i : component?.name] = data;
    }
    cursor.setPosition(staticPosition + 32);
    return [value, 32];
  }
  for (let i = 0; i < param.components.length; ++i) {
    const component = param.components[i];
    const [data, consumed_] = decodeParameter(cursor, component, {
      staticPosition
    });
    value[hasUnnamedChild ? i : component?.name] = data;
    consumed += consumed_;
  }
  return [value, consumed];
}
function decodeString(cursor, { staticPosition }) {
  const offset = bytesToNumber(cursor.readBytes(32));
  const start = staticPosition + offset;
  cursor.setPosition(start);
  const length = bytesToNumber(cursor.readBytes(32));
  if (length === 0) {
    cursor.setPosition(staticPosition + 32);
    return ["", 32];
  }
  const data = cursor.readBytes(length, 32);
  const value = bytesToString(data);
  cursor.setPosition(staticPosition + 32);
  return [value, 32];
}
function hasDynamicChild(param) {
  const { type } = param;
  if (type === "string")
    return true;
  if (type === "bytes")
    return true;
  if (type.endsWith("[]"))
    return true;
  if (type === "tuple")
    return param.components?.some(hasDynamicChild);
  const arrayComponents = getArrayComponents(param.type);
  if (arrayComponents && hasDynamicChild({ ...param, type: arrayComponents[1] }))
    return true;
  return false;
}
var sizeOfLength, sizeOfOffset;
var init_decodeAbiParameters = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/abi/decodeAbiParameters.js"() {
    init_abi();
    init_getAddress();
    init_cursor2();
    init_size();
    init_slice();
    init_fromBytes();
    init_toBytes();
    init_toHex();
    init_encodeAbiParameters();
    sizeOfLength = 32;
    sizeOfOffset = 32;
  }
});

// ../hoodstonk/app/node_modules/viem/_esm/utils/abi/decodeFunctionResult.js
function decodeFunctionResult(parameters) {
  const { abi, args, functionName, data } = parameters;
  let abiItem = abi[0];
  if (functionName) {
    const item = getAbiItem({ abi, args, name: functionName });
    if (!item)
      throw new AbiFunctionNotFoundError(functionName, { docsPath: docsPath4 });
    abiItem = item;
  }
  if (abiItem.type !== "function")
    throw new AbiFunctionNotFoundError(void 0, { docsPath: docsPath4 });
  if (!abiItem.outputs)
    throw new AbiFunctionOutputsNotFoundError(abiItem.name, { docsPath: docsPath4 });
  const values = decodeAbiParameters(abiItem.outputs, data);
  if (values && values.length > 1)
    return values;
  if (values && values.length === 1)
    return values[0];
  return void 0;
}
var docsPath4;
var init_decodeFunctionResult = __esm({
  "../hoodstonk/app/node_modules/viem/_esm/utils/abi/decodeFunctionResult.js"() {
    init_abi();
    init_decodeAbiParameters();
    init_getAbiItem();
    docsPath4 = "/docs/contract/decodeFunctionResult";
  }
});

// source/discovery.mjs
import { mkdir as mkdir3, readFile as readFile3, writeFile as writeFile3, rename as rename2 } from "node:fs/promises";
import path3 from "node:path";

// ../hoodstonk/app/node_modules/viem/_esm/index.js
init_exports();

// ../hoodstonk/app/node_modules/viem/_esm/utils/abi/encodeEventTopics.js
init_abi();

// ../hoodstonk/app/node_modules/viem/_esm/errors/log.js
init_base();
var FilterTypeNotSupportedError = class extends BaseError2 {
  constructor(type) {
    super(`Filter type "${type}" is not supported.`, {
      name: "FilterTypeNotSupportedError"
    });
  }
};

// ../hoodstonk/app/node_modules/viem/_esm/utils/abi/encodeEventTopics.js
init_toBytes();
init_keccak256();
init_toEventSelector();
init_encodeAbiParameters();
init_formatAbiItem2();
init_getAbiItem();
var docsPath = "/docs/contract/encodeEventTopics";
function encodeEventTopics(parameters) {
  const { abi, eventName, args } = parameters;
  let abiItem = abi[0];
  if (eventName) {
    const item = getAbiItem({ abi, name: eventName });
    if (!item)
      throw new AbiEventNotFoundError(eventName, { docsPath });
    abiItem = item;
  }
  if (abiItem.type !== "event")
    throw new AbiEventNotFoundError(void 0, { docsPath });
  let topics = [];
  if (args && "inputs" in abiItem) {
    const indexedInputs = abiItem.inputs?.filter((param) => "indexed" in param && param.indexed);
    const args_ = Array.isArray(args) ? args : Object.values(args).length > 0 ? indexedInputs?.map((x) => args[x.name]) ?? [] : [];
    if (args_.length > 0) {
      topics = indexedInputs?.map((param, i) => {
        if (Array.isArray(args_[i]))
          return args_[i].map((_, j) => encodeArg({ param, value: args_[i][j] }));
        return typeof args_[i] !== "undefined" && args_[i] !== null ? encodeArg({ param, value: args_[i] }) : null;
      }) ?? [];
    }
  }
  if (abiItem.anonymous)
    return topics;
  const definition = formatAbiItem2(abiItem);
  const signature = toEventSelector(definition);
  return [signature, ...topics];
}
function encodeArg({ param, value }) {
  if (param.type === "string" || param.type === "bytes")
    return keccak256(toBytes(value));
  if (param.type === "tuple" || param.type.match(/^(.*)\[(\d+)?\]$/))
    throw new FilterTypeNotSupportedError(param.type);
  return encodeAbiParameters([param], [value]);
}

// ../hoodstonk/app/node_modules/viem/_esm/utils/abi/decodeEventLog.js
init_abi();
init_cursor();
init_size();
init_toEventSelector();
init_decodeAbiParameters();
init_formatAbiItem2();
var docsPath3 = "/docs/contract/decodeEventLog";
function decodeEventLog(parameters) {
  const { abi, data, strict: strict_, topics } = parameters;
  const strict = strict_ ?? true;
  const [signature, ...argTopics] = topics;
  if (!signature)
    throw new AbiEventSignatureEmptyTopicsError({ docsPath: docsPath3 });
  const abiItem = abi.find((x) => x.type === "event" && signature === toEventSelector(formatAbiItem2(x)));
  if (!(abiItem && "name" in abiItem) || abiItem.type !== "event")
    throw new AbiEventSignatureNotFoundError(signature, { docsPath: docsPath3 });
  const { name, inputs } = abiItem;
  const isUnnamed = inputs?.some((x) => !("name" in x && x.name));
  const args = isUnnamed ? [] : {};
  const indexedInputs = inputs.map((x, i) => [x, i]).filter(([x]) => "indexed" in x && x.indexed);
  const missingIndexedInputs = [];
  for (let i = 0; i < indexedInputs.length; i++) {
    const [param, argIndex] = indexedInputs[i];
    const topic = argTopics[i];
    if (!topic) {
      if (strict)
        throw new DecodeLogTopicsMismatch({
          abiItem,
          param
        });
      missingIndexedInputs.push([param, argIndex]);
      continue;
    }
    args[isUnnamed ? argIndex : param.name || argIndex] = decodeTopic({
      param,
      value: topic
    });
  }
  const nonIndexedInputs = inputs.filter((x) => !("indexed" in x && x.indexed));
  const inputsToDecode = strict ? nonIndexedInputs : [...missingIndexedInputs.map(([param]) => param), ...nonIndexedInputs];
  if (inputsToDecode.length > 0) {
    if (data && data !== "0x") {
      try {
        const decodedData = decodeAbiParameters(inputsToDecode, data);
        if (decodedData) {
          let dataIndex = 0;
          if (!strict) {
            for (const [param, argIndex] of missingIndexedInputs) {
              args[isUnnamed ? argIndex : param.name || argIndex] = decodedData[dataIndex++];
            }
          }
          if (isUnnamed) {
            for (let i = 0; i < inputs.length; i++)
              if (args[i] === void 0 && dataIndex < decodedData.length)
                args[i] = decodedData[dataIndex++];
          } else
            for (let i = 0; i < nonIndexedInputs.length; i++)
              args[nonIndexedInputs[i].name] = decodedData[dataIndex++];
        }
      } catch (err) {
        if (strict) {
          if (err instanceof AbiDecodingDataSizeTooSmallError || err instanceof PositionOutOfBoundsError)
            throw new DecodeLogDataMismatch({
              abiItem,
              data,
              params: inputsToDecode,
              size: size(data)
            });
          throw err;
        }
      }
    } else if (strict) {
      throw new DecodeLogDataMismatch({
        abiItem,
        data: "0x",
        params: inputsToDecode,
        size: 0
      });
    }
  }
  return {
    eventName: name,
    args: Object.values(args).length > 0 ? args : void 0
  };
}
function decodeTopic({ param, value }) {
  if (param.type === "string" || param.type === "bytes" || param.type === "tuple" || param.type.match(/^(.*)\[(\d+)?\]$/))
    return value;
  const decodedArg = decodeAbiParameters([param], value) || [];
  return decodedArg[0];
}

// ../hoodstonk/app/node_modules/viem/_esm/index.js
init_decodeFunctionResult();
init_encodeAbiParameters();
init_encodeFunctionData();
init_keccak256();

// source/discovery-core.mjs
var rank = (row) => row.provenance?.kind === "platform" && row.provenance?.verified === true ? 0 : row.provenance?.kind === "ecosystem" && row.provenance?.verified === true ? 1 : 2;
var identity = (row) => `${row.chain}:${row.chain === "elysium" ? row.address.toLowerCase() : row.address}`;
function mergeMarkets(...groups) {
  const rows = /* @__PURE__ */ new Map();
  for (const row of groups.flat()) {
    if (!row?.address || !["solana", "elysium"].includes(row.chain)) continue;
    const key = identity(row), old = rows.get(key);
    if (!old) rows.set(key, row);
    else {
      const preferred = rank(row) <= rank(old) ? row : old;
      const other = preferred === row ? old : row;
      const poolA = preferred.poolId || preferred.original?.pairAddress;
      const poolB = other.poolId || other.original?.pairAddress;
      const conflict = poolA && poolB && poolA !== poolB;
      const merged = conflict ? { ...preferred } : { ...other, ...preferred };
      if (!conflict) {
        for (const field of ["price", "volume", "cap", "change", "image"]) if (row[field] !== null && row[field] !== void 0) merged[field] = row[field];
      }
      rows.set(key, merged);
    }
  }
  return [...rows.values()].sort((a, b) => rank(a) - rank(b) || (b.volume ?? -1) - (a.volume ?? -1) || a.address.localeCompare(b.address));
}
function retainPartialRows(previous, incoming, warnings = [], limit = 100) {
  const failed = warnings.some((w) => /(?:source|Name search).*is unavailable/i.test(w));
  if (!failed) return { rows: incoming, retained: 0, sourceFailed: false };
  const present = new Set(incoming.map(identity));
  const stale = previous.filter((row) => !present.has(identity(row))).slice(0, Math.max(0, limit - incoming.length)).map((row) => ({ ...row, stale: true }));
  return { rows: mergeMarkets(incoming, stale), retained: stale.length, sourceFailed: true };
}
function sourceFailure(previous, error, now = (/* @__PURE__ */ new Date()).toISOString()) {
  return { ...previous, status: previous?.checkedAt ? "stale" : "unavailable", complete: false, error: String(error).slice(0, 180), attemptedAt: now };
}
function platformProof(log, launcher, topic, from, to) {
  return !log.removed && log.address?.toLowerCase() === launcher.toLowerCase() && log.topics?.[0] === topic && /^0x[0-9a-f]{64}$/i.test(log.transactionHash || "") && Number(BigInt(log.blockNumber)) >= from && Number(BigInt(log.blockNumber)) <= to;
}
function sourceNote(sources) {
  return Object.entries(sources).map(([name, s]) => `${name}: ${s.status}${s.count === null || s.count === void 0 ? "" : ` (${s.count})`}${s.error ? ` \u2014 ${s.error}` : ""}`).join(" \xB7 ");
}

// source/pump-provenance.mjs
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
var messageHash = (message) => createHash("sha256").update(Buffer.from(message, "base64")).digest("hex");
var writes = Promise.resolve();
function recordPumpBuild({ directory, built, message }) {
  const write = async () => {
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, "pump-builds.json");
    let rows = [];
    try {
      rows = JSON.parse(await readFile(file, "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    const hash2 = messageHash(message);
    rows = rows.filter((row) => row.messageHash !== hash2);
    rows.push({ mint: built.mint, wallet: built.wallet, quoteMint: built.quote.mint, messageHash: hash2, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
    await writeFile(file + ".tmp", JSON.stringify(rows.slice(-500)));
    await rename(file + ".tmp", file);
  };
  const pending = writes.then(write, write);
  writes = pending.catch(() => {
  });
  return pending;
}
function matchesPumpReceipt(candidate, transaction, message, curve) {
  return transaction?.meta?.err === null && messageHash(message) === candidate.messageHash && curve?.creator === candidate.wallet && curve?.quoteMint === candidate.quoteMint && curve?.creatorFeeBps === 300 && !!curve?.curve;
}

// source/artwork.mjs
import { mkdir as mkdir2, readFile as readFile2, writeFile as writeFile2 } from "node:fs/promises";
import path2 from "node:path";

// source/token-metadata.mjs
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
var MINT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
var CID = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{50,})$/;
var DEFAULT_IPFS_GATEWAYS = Object.freeze(["https://ipfs.filebase.io/ipfs/", "https://pump.mypinata.cloud/ipfs/"]);
var METAPLEX = "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s";
var PRIVATE_IP = [/^0\./, /^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^(22[4-9]|2[3-5]\d)\./, /^::1?$/, /^f[c-d]/i, /^fe[89ab]/i, /^::ffff:/i, /^64:ff9b:/i];
async function isPublicHttps(value, resolveHost = (host) => lookup(host, { all: true })) {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.username || u.password || u.port || isIP(u.hostname.replace(/^\[|\]$/g, "")) || !u.hostname.includes(".") || /(^|\.)(localhost|local|internal|lan|home|arpa|corp)$/i.test(u.hostname)) return false;
    const addrs = await resolveHost(u.hostname);
    return Array.isArray(addrs) && addrs.length > 0 && addrs.every((a) => !PRIVATE_IP.some((r) => r.test(a.address)));
  } catch {
    return false;
  }
}
var ART_TTL = 6 * 36e5;
var MISS_TTL = 12e4;
var EMPTY_TTL = 18e5;
var CAP_TTL = 6e4;
var MAX_ENTRIES = 2e3;
function parseMetaplexUri(data) {
  let o = 65;
  const str = () => {
    const n = data.readUInt32LE(o);
    o += 4;
    if (n > 1e3 || o + n > data.length) throw new Error("metadata");
    const s = data.subarray(o, o + n).toString("utf8").replace(/\0+$/, "").trim();
    o += n;
    return s;
  };
  str();
  str();
  return str();
}
function ipfsParts(value) {
  try {
    if (typeof value !== "string") return null;
    if (value.startsWith("ipfs://")) {
      const [cid, ...rest] = value.slice(7).replace(/^ipfs\//, "").split("/");
      return CID.test(cid) ? { cid, path: rest.length ? `/${rest.join("/")}` : "" } : null;
    }
    const u = new URL(value);
    const sub = u.hostname.match(/^([a-z0-9]+)\.ipfs\./i);
    if (sub && CID.test(sub[1])) return { cid: sub[1], path: u.pathname === "/" ? "" : u.pathname };
    const m = u.pathname.match(/^\/ipfs\/([^/]+)(\/.*)?$/);
    if (m && CID.test(m[1])) return { cid: m[1], path: m[2] || "" };
  } catch {
  }
  return null;
}
function artworkCandidates(value, gateways = DEFAULT_IPFS_GATEWAYS) {
  const ipfs = ipfsParts(value), out = ipfs ? gateways.map((g) => `${g}${ipfs.cid}${ipfs.path}`) : [];
  try {
    const u = new URL(value);
    if (u.protocol === "https:") out.push(u.href);
  } catch {
  }
  return [...new Set(out)];
}
function createTokenMetadata({ fetcher = fetch, env = {}, now = Date.now, infrastructure = null, resolveHost, metadataAddress, allowedMetadata = isPublicHttps, log = () => {
}, sleep: sleep2 = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const jupKey = env.JUP_API_KEY || env.JUPITER_API_KEY || "";
  const gateways = (env.IPFS_GATEWAYS || "").split(",").map((s) => s.trim()).filter((s) => /^https:\/\/[^/]+\/(ipfs\/)?$/.test(s)).map((s) => s.endsWith("ipfs/") ? s : `${s}ipfs/`);
  const gw = gateways.length ? gateways : DEFAULT_IPFS_GATEWAYS;
  const art = /* @__PURE__ */ new Map();
  const breaker = { jupiter: { until: 0, fails: 0 }, pump: { until: 0, fails: 0 } };
  const trip = (name, why) => {
    const b = breaker[name];
    if (now() < b.until) return;
    b.fails++;
    const wait = Math.min(6e5, 15e3 * 2 ** (b.fails - 1));
    b.until = now() + wait;
    log(`${name} unavailable (${why}); backing off ${Math.round(wait / 1e3)}s`);
  };
  const ok = (name) => {
    breaker[name].fails = 0;
    breaker[name].until = 0;
  };
  const open = (name) => now() < breaker[name].until;
  const entry = (mint) => art.get(mint) || {};
  function put(mint, patch) {
    const prev = entry(mint);
    art.delete(mint);
    art.set(mint, { ...prev, ...patch });
    if (art.size > MAX_ENTRIES) art.delete(art.keys().next().value);
  }
  async function getJson(url, { headers = {}, timeout = 8e3, limit = 0, follow = null } = {}) {
    let r;
    for (let hop = 0; ; hop++) {
      try {
        r = await fetcher(url, { headers: { accept: "application/json", ...headers }, redirect: "manual", signal: AbortSignal.timeout(timeout) });
      } catch (e) {
        throw Object.assign(new Error(`${e.name}: ${e.message}${e.cause?.code ? ` (${e.cause.code})` : ""}`), { transport: true });
      }
      const next = r.status >= 300 && r.status < 400 && r.headers.get("location");
      if (!next || !follow || hop >= 2) break;
      const target = new URL(next, url).href;
      if (!await follow(target)) break;
      url = target;
    }
    if (!r.ok) {
      let body = "";
      try {
        body = (await r.text()).replace(/\s+/g, " ").slice(0, 160);
      } catch {
      }
      throw Object.assign(new Error(`HTTP ${r.status}${body ? ` ${body}` : ""}`), { status: r.status });
    }
    const reader = r.body.getReader(), chunks = [];
    let size2 = 0;
    const cap = limit || 5e5;
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      size2 += value.length;
      if (size2 > cap) {
        await reader.cancel();
        throw new Error("response too large");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  }
  async function jupiter(mints) {
    const hosts = jupKey ? ["https://api.jup.ag"] : ["https://api.jup.ag", "https://lite-api.jup.ag"];
    for (let start = 0; start < mints.length; start += 20) {
      if (open("jupiter")) return;
      const group = mints.slice(start, start + 20), q = new URLSearchParams({ query: group.join(",") });
      let records = null, errors = [];
      for (const host of hosts) {
        for (let attempt = 0; attempt < 2 && !records; attempt++) {
          try {
            const data = await getJson(`${host}/tokens/v2/search?${q}`, { headers: jupKey ? { "x-api-key": jupKey } : {} });
            if (!Array.isArray(data)) throw new Error("unexpected response shape");
            records = { host, data };
          } catch (e) {
            errors.push(`${host.replace("https://", "")}: ${e.message}`);
            if (e.status === 429 && attempt === 0) await sleep2(750);
            else break;
          }
        }
        if (records) break;
      }
      if (!records) {
        trip("jupiter", errors.join(" | "));
        return;
      }
      ok("jupiter");
      const wanted = new Set(group);
      for (const r of records.data) {
        if (!wanted.has(r?.id)) continue;
        const images = artworkCandidates(r.icon, gw), cap = Number.isFinite(Number(r.mcap)) && Number(r.mcap) >= 0 ? Number(r.mcap) : null;
        const sourceUrl = `${records.host}/tokens/v2/search?query=${r.id}`;
        put(r.id, { answeredAt: now(), capAt: now(), marketCapUsd: cap, capSourceUrl: sourceUrl, ...images.length ? { images, artAt: now(), source: "jupiter", sourceUrl } : {} });
      }
    }
  }
  async function pump(mint) {
    if (open("pump")) return false;
    try {
      const c = await getJson(`https://frontend-api-v3.pump.fun/coins/${mint}`, { timeout: 6e3, limit: 2e5 });
      ok("pump");
      if (c?.mint !== mint) return false;
      const images = artworkCandidates(c.image_uri, gw), cap = Number.isFinite(Number(c.usd_market_cap)) && Number(c.usd_market_cap) > 0 ? Number(c.usd_market_cap) : null;
      const sourceUrl = `https://pump.fun/coin/${mint}`;
      put(mint, { answeredAt: now(), ...cap != null && !(entry(mint).capAt > now() - CAP_TTL) ? { marketCapUsd: cap, capAt: now(), capSourceUrl: sourceUrl } : {}, ...images.length ? { images, artAt: now(), source: "pump.fun", sourceUrl } : {} });
      return images.length > 0;
    } catch (e) {
      if (e.status === 403 || e.status === 429 || e.status >= 500 || e.transport) trip("pump", e.message);
      return false;
    }
  }
  async function metadataJson(uri) {
    const allowed = async (u) => await allowedMetadata(u) && await isPublicHttps(u, resolveHost);
    const ipfs = ipfsParts(uri), urls = ipfs ? gw.map((g) => `${g}${ipfs.cid}${ipfs.path}`) : await allowed(uri) ? [uri] : [];
    for (const url of urls) {
      try {
        if (!await allowed(url)) continue;
        return await getJson(url, { timeout: 5e3, limit: 64e3, follow: allowed });
      } catch (e) {
        log(`metadata JSON ${new URL(url).hostname}: ${e.message}`);
      }
    }
    return null;
  }
  async function onChain(mints) {
    if (!infrastructure?.getAccounts || !mints.length) return;
    const uris = /* @__PURE__ */ new Map();
    try {
      const mintAccounts = await infrastructure.getAccounts(mints, "jsonParsed");
      mintAccounts.forEach((a, i) => {
        if (!["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"].includes(a?.owner)) return;
        const ext = a?.data?.parsed?.info?.extensions?.find?.((x) => x?.extension === "tokenMetadata");
        if (typeof ext?.state?.uri === "string" && ext.state.uri) uris.set(mints[i], ext.state.uri);
      });
    } catch (e) {
      log(`token-2022 metadata read failed: ${e.message}`);
    }
    const rest = mints.filter((m) => !uris.has(m));
    if (rest.length) {
      try {
        const pdas = rest.map(metadataAddress), accounts = await infrastructure.getAccounts(pdas, "base64");
        accounts.forEach((a, i) => {
          if (a?.owner !== METAPLEX || !Array.isArray(a.data)) return;
          try {
            const uri = parseMetaplexUri(Buffer.from(a.data[0], "base64"));
            if (uri) uris.set(rest[i], uri);
          } catch {
          }
        });
      } catch (e) {
        log(`metaplex metadata read failed: ${e.message}`);
      }
    }
    await pool([...uris], 4, async ([mint, uri]) => {
      const json = await metadataJson(uri);
      if (!json) return;
      const images = artworkCandidates(typeof json.image === "string" ? json.image : "", gw);
      put(mint, { answeredAt: now(), ...images.length ? { images, artAt: now(), source: "on-chain metadata", sourceUrl: `https://solscan.io/token/${mint}` } : {} });
    });
  }
  async function pool(items, size2, fn) {
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(size2, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    }));
  }
  return {
    gateways: gw,
    candidates: (value) => artworkCandidates(value, gw),
    // tokens: [{mint,image}] where image is the DexScreener artwork (may be null). Returns the cache view.
    async resolve(tokens, { fallbackLimit = 60 } = {}) {
      const t = now(), mints = [...new Set(tokens.map((x) => x.mint).filter((m) => MINT.test(m)))];
      const capStale = mints.filter((m) => !(entry(m).capAt > t - CAP_TTL));
      const artStale = (m) => {
        const e = entry(m);
        if (e.images?.length) return !(e.artAt > t - ART_TTL);
        return !(e.answeredAt > t - EMPTY_TTL) && !(e.missAt > t - MISS_TTL);
      };
      if (capStale.length) await jupiter(capStale);
      const dexImage = new Map(tokens.map((x) => [x.mint, x.image]));
      const need = mints.filter(artStale).slice(0, fallbackLimit);
      const pumpMints = need.filter((m) => m.endsWith("pump"));
      await pool(pumpMints, 4, pump);
      await onChain(need.filter((m) => !(entry(m).images?.length && entry(m).artAt >= t)));
      for (const m of need) if (!(entry(m).answeredAt >= t) && !dexImage.get(m)) put(m, { missAt: now() });
      return new Map(mints.map((m) => [m, entry(m)]));
    },
    status() {
      return { jupiterKeyConfigured: Boolean(jupKey), jupiterBackoffUntil: breaker.jupiter.until || null, pumpBackoffUntil: breaker.pump.until || null, cachedArtwork: [...art.values()].filter((e) => e.images?.length).length };
    }
  };
}

// source/artwork.mjs
var HOSTS = /* @__PURE__ */ new Set(["cdn.dexscreener.com", "dd.dexscreener.com", "ipfs.io", "ipfs.filebase.io", "pump.mypinata.cloud", "gateway.pinata.cloud", "cloudflare-ipfs.com", "arweave.net", "static.jup.ag", "raw.githubusercontent.com", "assets.coingecko.com", "coin-images.coingecko.com", "metadata.jup.ag"]);
function allowedArtworkURL(value, extraHosts = /* @__PURE__ */ new Set()) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password && !u.port && (HOSTS.has(u.hostname) || extraHosts.has(u.hostname));
  } catch {
    return false;
  }
}
function imageType(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (/^GIF8[79]a$/.test(bytes.subarray(0, 6).toString())) return "image/gif";
  if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}
var imageRoute = (row) => row.chain === "solana" ? `/api/discovery/art/solana/${row.address}` : row.image || "";
function createArtwork({ env, directory, getRows, getCachedArtwork = () => null, getAccounts, metadataAddress, fetcher = fetch, resolveHost }) {
  const extraHosts = /* @__PURE__ */ new Set();
  for (const row of getRows()) for (const url of getCachedArtwork(row.address)?.urls || []) try {
    extraHosts.add(new URL(url).hostname);
  } catch {
  }
  const allowed = (u) => allowedArtworkURL(u, extraHosts);
  const metadata = createTokenMetadata({ fetcher, env, infrastructure: { getAccounts }, metadataAddress, allowedMetadata: allowed, resolveHost });
  const cache = /* @__PURE__ */ new Map(), pending = /* @__PURE__ */ new Map();
  const metadataBatch = (mint) => metadata.resolve([{ mint, image: getRows().find((r) => r.address === mint)?.image }], { fallbackLimit: 1 });
  let active = 0;
  const waiters = [];
  const acquire = async () => {
    if (active >= 4) await new Promise((r) => waiters.push(r));
    active++;
  };
  const release = () => {
    active--;
    waiters.shift()?.();
  };
  async function download(input) {
    let url = input;
    for (let hop = 0; hop < 3; hop++) {
      if (!allowed(url) || !await isPublicHttps(url, resolveHost)) throw Error("Artwork host disallowed");
      const r = await fetcher(url, { redirect: "manual", signal: AbortSignal.timeout(8e3), headers: { accept: "image/png,image/jpeg,image/webp,image/gif" } });
      if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
        url = new URL(r.headers.get("location"), url).href;
        continue;
      }
      if (!r.ok || Number(r.headers.get("content-length")) > 2e6) throw Error("Artwork unavailable or oversized");
      const reader = r.body.getReader(), chunks = [];
      let length = 0;
      for (; ; ) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 2e6) {
          await reader.cancel();
          throw Error("Oversized artwork");
        }
        chunks.push(value);
      }
      const body = Buffer.concat(chunks), type = imageType(body);
      if (!type) throw Error("Unsupported artwork type");
      return { body, type };
    }
    throw Error("Too many artwork redirects");
  }
  async function load(mint) {
    const row = getRows().find((r) => r.chain === "solana" && r.address === mint);
    if (!row) return null;
    const file = path2.join(directory, mint + ".img");
    try {
      const body = await readFile2(file), type = imageType(body);
      if (type && body.length <= 2e6) return { body, type };
    } catch {
    }
    const direct = [row.image, ...row.imageCandidates || [], ...getCachedArtwork(mint)?.urls || []].filter((u) => typeof u === "string" && u.startsWith("https:"));
    let candidates = [...new Set(direct.flatMap((u) => artworkCandidates(u)))].filter(allowed).slice(0, 4);
    for (const url of candidates) try {
      const out = await download(url);
      await mkdir2(directory, { recursive: true });
      await writeFile2(file, out.body);
      return out;
    } catch {
    }
    const resolved = (await metadataBatch(mint)).get(mint);
    candidates = [...new Set(resolved?.images || [])].filter(allowed).slice(0, 4);
    for (const url of candidates) try {
      const out = await download(url);
      await mkdir2(directory, { recursive: true });
      await writeFile2(file, out.body);
      return out;
    } catch {
    }
    return null;
  }
  async function get(mint) {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint) || !getRows().some((r) => r.chain === "solana" && r.address === mint)) return null;
    const prior = cache.get(mint);
    if (prior && Date.now() < prior.until) return prior.asset;
    if (pending.has(mint)) return pending.get(mint);
    const promise = (async () => {
      await acquire();
      try {
        const asset = await load(mint);
        cache.set(mint, { asset, until: Date.now() + (asset ? 216e5 : 12e4) });
        if (cache.size > 100) cache.delete(cache.keys().next().value);
        return asset;
      } finally {
        release();
        pending.delete(mint);
      }
    })();
    pending.set(mint, promise);
    return promise;
  }
  return { get, status: () => ({ cached: cache.size, loaded: [...cache.values()].filter((x) => x.asset).length, ...metadata.status() }) };
}

// source/discovery.mjs
var launchAbi = parseAbi(["event Launched(address indexed token,address indexed creator,address indexed pair,bytes32 poolId,uint256 supply,uint256 openingMarketCap,uint16 feeBps)"]);
var initAbi = parseAbi(["event Initialize(bytes32 indexed id,address indexed currency0,address indexed currency1,uint24 fee,int24 tickSpacing,address hooks,uint160 sqrtPriceX96,int24 tick)"]);
var tokenAbi = parseAbi(["function name() view returns (string)", "function symbol() view returns (string)", "function decimals() view returns (uint8)"]);
var launchTopic = encodeEventTopics({ abi: launchAbi, eventName: "Launched" })[0];
var initTopic = encodeEventTopics({ abi: initAbi, eventName: "Initialize" })[0];
var ZERO = "0x0000000000000000000000000000000000000000";
var ECOSYSTEM = "CsMF3EMEVm9ow925mtFVwnAvTYUgckcQJrFUWEFMpump";
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var clean2 = (s, n = 80) => String(s || "").replace(/[\u0000-\u001f\u007f\u202a-\u202e]/g, "").slice(0, n);
var emptyRow = (chain, address) => ({ chain, address, name: address, symbol: address.slice(0, 8), price: null, volume: null, cap: null, change: null, holders: null, series: [], unit: chain === "solana" ? "USD" : "HYPE", pair: "" });
async function createMarketDiscovery({ env = process.env, manifest, fetcher = fetch, apiBase = `http://127.0.0.1:${env.PORT || 3e3}`, seedPath = new URL("./discovery-seed.json", import.meta.url), autoStart = true, decodeMessage, getCachedArtwork, metadataAddress }) {
  const dir = path3.join(env.PAD_DATA_DIR || "./data", "discovery"), file = path3.join(dir, "verified-markets.json");
  let state = { version: 1, chainId: manifest.chainId, launcher: manifest.carbon.launcher.toLowerCase(), launches: [], rows: [], sources: Object.fromEntries(["platformEvm", "platformSolana", "evmMarkets", "solanaMarkets", "ecosystem"].map((name) => [name, { status: "pending", complete: false, count: null }])), cursor: manifest.carbon.deployBlock - 1 };
  for (const location of [seedPath, file]) {
    try {
      const saved = JSON.parse(await readFile3(location, "utf8"));
      if (saved.version === 1 && saved.chainId === manifest.chainId && saved.launcher === state.launcher) state = saved;
    } catch {
    }
  }
  let busy = false, nextAttempt = 0, failures = 0;
  const urls = (env.ELYSIUM_RPC_URL || manifest.rpcFailover.join(",")).split(",").map((x) => x.trim()).filter(Boolean);
  let provider = 0;
  async function json(url, options = {}) {
    const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(2e4) });
    if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
    const result = await response.json();
    if (result.error) throw new Error(typeof result.error === "string" ? result.error : result.error.message);
    return result;
  }
  async function rpc(method, params) {
    let error;
    for (let i = 0; i < urls.length * 2; i++) {
      try {
        const out = await json(urls[provider % urls.length], { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
        if (out.result === void 0) throw Error("RPC result missing");
        return out.result;
      } catch (e) {
        error = e;
        provider++;
        await sleep(Math.min(250 * 2 ** i, 2e3));
      }
    }
    throw error;
  }
  async function persist() {
    await mkdir3(dir, { recursive: true });
    await writeFile3(file + ".tmp", JSON.stringify(state));
    await rename2(file + ".tmp", file);
  }
  async function metadata(address) {
    const old = state.rows.find((row) => row.chain === "elysium" && row.address.toLowerCase() === address.toLowerCase());
    if (old?.metadataVerified) return { name: old.name, symbol: old.symbol, decimals: old.decimals, metadataVerified: true };
    const values = {};
    for (const name of ["symbol", "name", "decimals"]) {
      const result = await rpc("eth_call", [{ to: address, data: encodeFunctionData({ abi: tokenAbi, functionName: name }) }, "latest"]);
      values[name] = decodeFunctionResult({ abi: tokenAbi, functionName: name, data: result });
    }
    return { name: clean2(values.name), symbol: clean2(values.symbol, 24), decimals: Number(values.decimals), metadataVerified: true };
  }
  async function evm() {
    const chain = Number(BigInt(await rpc("eth_chainId", [])));
    if (chain !== 99901) throw Error("Unexpected Elysium chain ID");
    const head = Number(BigInt(await rpc("eth_blockNumber", []))), to = head - 64;
    if (to < state.cursor - 64) throw Error("RPC head is behind the saved launch checkpoint");
    if (await rpc("eth_getCode", [manifest.carbon.launcher, "latest"]) === "0x") throw Error("Authorized launcher has no bytecode");
    const from = Math.max(manifest.carbon.deployBlock, state.cursor - 64);
    const launchRows = state.rows.filter((r) => r.chain === "elysium" && r.provenance?.kind === "platform");
    for (let block = from; block <= to; block += 5e4) {
      const end = Math.min(block + 49999, to);
      const logs = await rpc("eth_getLogs", [{ address: manifest.carbon.launcher, topics: [launchTopic], fromBlock: `0x${block.toString(16)}`, toBlock: `0x${end.toString(16)}` }]);
      for (const log of logs) {
        if (!platformProof(log, manifest.carbon.launcher, launchTopic, block, end)) continue;
        const { args: a } = decodeEventLog({ abi: launchAbi, data: log.data, topics: log.topics });
        let key;
        for (const tickSpacing of [60, 200, 10, 1, 100, 2e3, 50, 20, 120]) {
          const [currency0, currency1] = [a.token, a.pair].sort((x, y) => BigInt(x) < BigInt(y) ? -1 : 1);
          const candidate = { currency0, currency1, fee: 0, tickSpacing, hooks: manifest.carbon.feeHook };
          const id = keccak256(encodeAbiParameters([{ type: "address" }, { type: "address" }, { type: "uint24" }, { type: "int24" }, { type: "address" }], Object.values(candidate)));
          if (id === a.poolId) key = candidate;
        }
        if (!key) throw Error("Platform event pool key could not be verified");
        const item = { ...a, supply: a.supply.toString(), openingMarketCap: a.openingMarketCap.toString(), key, block: Number(BigInt(log.blockNumber)), transactionHash: log.transactionHash };
        state.launches = state.launches.filter((x) => x.token.toLowerCase() !== a.token.toLowerCase()).concat(item);
        let meta = {};
        try {
          meta = await metadata(a.token);
        } catch {
        }
        launchRows.push({ ...emptyRow("elysium", a.token), ...meta, pair: a.pair, poolId: a.poolId, provenance: { kind: "platform", verified: true, source: "Authorized HypurrLabs launcher event", launcher: manifest.carbon.launcher, transactionHash: log.transactionHash, block: item.block } });
      }
      state.cursor = end;
      state.rows = mergeMarkets(state.rows, launchRows);
      await persist();
      await sleep(150);
    }
    state.sources.platformEvm = { status: "complete", complete: true, count: state.launches.length, fromBlock: manifest.carbon.deployBlock, throughBlock: to, head, confirmations: 64, checkedAt: (/* @__PURE__ */ new Date()).toISOString() };
    if (state.sources.evmMarkets?.checkedAt && Date.now() - Date.parse(state.sources.evmMarkets.checkedAt) < 3e5) return;
    const marketFrom = Math.max(0, to - 2e5), pools = /* @__PURE__ */ new Map();
    try {
      for (let block = marketFrom; block <= to; block += 5e4) {
        const logs = await rpc("eth_getLogs", [{ topics: [initTopic], fromBlock: `0x${block.toString(16)}`, toBlock: `0x${Math.min(block + 49999, to).toString(16)}` }]);
        for (const log of logs) {
          if (log.removed) continue;
          const { args: a } = decodeEventLog({ abi: initAbi, data: log.data, topics: log.topics });
          const native = [ZERO, manifest.whype.toLowerCase()];
          const address = native.includes(a.currency0.toLowerCase()) ? a.currency1 : native.includes(a.currency1.toLowerCase()) ? a.currency0 : null;
          if (address && !native.includes(address.toLowerCase())) pools.set(address.toLowerCase(), { address, poolId: a.id, manager: log.address, block: Number(BigInt(log.blockNumber)), transactionHash: log.transactionHash, key: { currency0: a.currency0, currency1: a.currency1, fee: a.fee, tickSpacing: a.tickSpacing, hooks: a.hooks } });
        }
        await sleep(150);
      }
      const candidates = [...pools.values()].sort((a, b) => b.block - a.block).slice(0, 30), rows = [];
      let missingMetadata = 0;
      for (const pool of candidates) {
        let meta = {};
        try {
          meta = await metadata(pool.address);
        } catch {
          missingMetadata++;
        }
        rows.push({ ...emptyRow("elysium", pool.address), ...meta, pair: "HYPE / WHYPE", poolId: pool.poolId, manager: pool.manager, key: pool.key, provenance: { kind: "market", verified: true, source: "V4 pool initialization event (not platform launch)", transactionHash: pool.transactionHash, block: pool.block } });
      }
      state.rows = mergeMarkets(state.rows.filter((r) => r.chain !== "elysium" || r.provenance?.kind === "platform"), rows);
      state.sources.evmMarkets = { status: "partial", complete: false, count: rows.length, observedCandidates: pools.size, limit: 30, fromBlock: marketFrom, throughBlock: to, missingMetadata, checkedAt: (/* @__PURE__ */ new Date()).toISOString(), coverage: "Latest 30 native/WHYPE V4 pools initialized in the last 200,000 confirmed blocks; metrics unavailable until indexed." };
    } catch (e) {
      state.sources.evmMarkets = sourceFailure(state.sources.evmMarkets, "Elysium wider discovery provider unavailable");
    }
  }
  function dexRow(pair, mint, provenance) {
    const token = pair.baseToken;
    if (pair.chainId !== "solana" || token?.address !== mint) return null;
    return { ...emptyRow("solana", mint), name: clean2(token.name), symbol: clean2(token.symbol, 24), image: pair.info?.imageUrl || "", pair: pair.quoteToken?.symbol || "", price: pair.priceUsd == null ? null : Number(pair.priceUsd), volume: pair.volume?.h24 ?? null, cap: pair.marketCap ?? null, change: pair.priceChange?.h24 ?? null, original: { mint, name: clean2(token.name), symbol: clean2(token.symbol), quoteSymbol: pair.quoteToken?.symbol, priceUsd: pair.priceUsd, marketCapUsd: pair.marketCap, volume24hUsd: pair.volume?.h24, change24h: pair.priceChange?.h24, pairAddress: pair.pairAddress }, provenance };
  }
  async function mintMarket(mint, provenance) {
    let pairs;
    try {
      pairs = await json(`https://api.dexscreener.com/token-pairs/v1/solana/${mint}`);
    } catch {
      return { ...emptyRow("solana", mint), ...state.rows.find((r) => r.chain === "solana" && r.address === mint), original: state.rows.find((r) => r.chain === "solana" && r.address === mint)?.original || { mint }, provenance, metadataUnavailable: true };
    }
    const pair = pairs.filter((p) => p.chainId === "solana" && p.baseToken?.address === mint).sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
    return pair ? dexRow(pair, mint, provenance) : { ...emptyRow("solana", mint), original: { mint }, provenance };
  }
  async function solana() {
    const now = () => (/* @__PURE__ */ new Date()).toISOString();
    let directError = null;
    try {
      let candidates = [];
      try {
        candidates = JSON.parse(await readFile3(path3.join(dir, "pump-builds.json"), "utf8"));
      } catch (e) {
        if (e.code !== "ENOENT") throw e;
      }
      const pending = candidates.filter((c) => !state.rows.some((r) => r.chain === "solana" && r.address === c.mint && r.provenance?.kind === "platform") && Date.now() - Date.parse(c.createdAt) < 864e5).slice(-10);
      if (pending.length && !decodeMessage) throw Error("Receipt decoder unavailable");
      const endpoint = env.PURRLYSIUM_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
      const solRpc = async (method, params) => (await json(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).result;
      for (const candidate of pending) {
        const signatures = await solRpc("getSignaturesForAddress", [candidate.mint, { limit: 5, commitment: "confirmed" }]);
        for (const entry of signatures || []) {
          if (entry.err) continue;
          const tx = await solRpc("getTransaction", [entry.signature, { encoding: "base64", commitment: "confirmed", maxSupportedTransactionVersion: 0 }]);
          if (!tx?.transaction?.[0] || tx.meta?.err !== null) continue;
          const curve = await json(apiBase + "/api/purrlysium/solana/launch/state?mint=" + candidate.mint);
          if (!matchesPumpReceipt(candidate, tx, decodeMessage(tx.transaction[0]), curve)) continue;
          const row = await mintMarket(candidate.mint, { kind: "platform", verified: true, source: "Confirmed Pump creation matching the persisted server-built transaction message", transactionHash: entry.signature, messageHash: candidate.messageHash });
          state.rows = mergeMarkets(state.rows, [row]);
          break;
        }
      }
    } catch (e) {
      directError = "Direct Pump receipt verification is incomplete; retained prior verified records.";
    }
    try {
      const registry = await json(apiBase + "/api/purrlysium/solana/launches");
      if (!registry.available) throw Error("Platform registry is not configured; historical launch provenance unavailable");
      const verified = [];
      for (const record of registry.records.slice(0, 50)) {
        const check = await json(apiBase + "/api/purrlysium/solana/launch/state?mint=" + encodeURIComponent(record.mint));
        if (!check.registeredHere) continue;
        verified.push(await mintMarket(record.mint, { kind: "platform", verified: true, source: "Verified platform program record and matching Pump curve", programId: registry.programId, record: record.address }));
      }
      const incomplete = registry.truncated || registry.records.length > 50;
      const missing = incomplete ? state.rows.filter((r) => r.chain === "solana" && r.provenance?.kind === "platform" && r.provenance?.programId && !verified.some((v) => v.address === r.address)).map((r) => ({ ...r, stale: true })) : [];
      state.rows = mergeMarkets(state.rows.filter((r) => r.chain !== "solana" || r.provenance?.kind !== "platform" || !r.provenance?.programId), missing, verified);
      state.sources.platformSolana = { status: registry.truncated || registry.records.length > 50 ? "partial" : "complete", complete: !registry.truncated && registry.records.length <= 50, count: verified.length, checkedAt: now() };
    } catch (e) {
      state.sources.platformSolana = sourceFailure(state.sources.platformSolana, "Legacy program registry is unavailable; pre-migration direct Pump launch provenance is unknown. New server-built messages are persisted and verified against confirmed receipts.");
      state.sources.platformSolana.count = state.rows.filter((r) => r.chain === "solana" && r.provenance?.kind === "platform").length || null;
    }
    const known = state.rows.filter((r) => r.chain === "solana" && r.provenance?.kind === "platform").length;
    if (state.sources.platformSolana.complete) state.sources.platformSolana.count = known;
    if (known && state.sources.platformSolana.status === "unavailable") state.sources.platformSolana = { ...state.sources.platformSolana, status: "partial", count: known, complete: false, checkedAt: now() };
    if (directError) state.sources.platformSolana = { ...state.sources.platformSolana, status: known ? "stale" : "unavailable", complete: false, error: directError };
    try {
      const endpoint = env.PURRLYSIUM_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
      const account = await json(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [ECOSYSTEM, { encoding: "jsonParsed", commitment: "confirmed" }] }) });
      if (!["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"].includes(account.result?.value?.owner) || account.result.value.data?.parsed?.type !== "mint") throw Error("Ecosystem mint account could not be verified");
      const row = await mintMarket(ECOSYSTEM, { kind: "ecosystem", verified: true, source: "Owner-specified ecosystem mint; SPL mint verified; not proven platform-launched" });
      state.rows = mergeMarkets(state.rows, [row]);
      state.sources.ecosystem = { status: "complete", complete: true, count: 1, checkedAt: now() };
    } catch (e) {
      state.sources.ecosystem = sourceFailure(state.sources.ecosystem, "Ecosystem mint verification provider unavailable");
    }
    try {
      const scan = await json(apiBase + "/api/purrlysium/solana/scan");
      const rows = (scan.tokens || []).map((t) => ({ ...emptyRow("solana", t.mint), name: t.name, symbol: t.symbol, image: t.image, imageCandidates: t.imageCandidates || [], pair: t.quoteSymbol || "", price: t.priceUsd ?? null, volume: t.volume24hUsd ?? null, cap: t.marketCapUsd ?? null, change: t.change24h ?? null, original: t, provenance: { kind: "market", verified: false, source: "Dexscreener bounded market scan; no platform-launch claim" } }));
      const retained = retainPartialRows(state.rows.filter((r) => r.chain === "solana" && r.provenance?.kind === "market"), rows, scan.warnings || []);
      state.rows = mergeMarkets(state.rows.filter((r) => r.chain !== "solana" || r.provenance?.kind !== "market"), retained.rows);
      state.sources.solanaMarkets = { status: retained.sourceFailed ? "partial-error" : "partial", complete: false, count: retained.rows.length, returned: rows.length, retainedStale: retained.retained, checkedAt: scan.checkedAt, coverage: scan.coverage, warnings: scan.warnings || [] };
    } catch (e) {
      state.sources.solanaMarkets = sourceFailure(state.sources.solanaMarkets, "Solana market provider unavailable");
    }
  }
  async function refresh() {
    if (busy || Date.now() < nextAttempt) return;
    busy = true;
    try {
      await Promise.all([evm().catch((e) => {
        state.sources.platformEvm = sourceFailure(state.sources.platformEvm, "Platform launch scan incomplete: RPC unavailable");
      }), solana()]);
      state.checkedAt = (/* @__PURE__ */ new Date()).toISOString();
      await persist();
      failures = ["stale", "unavailable"].includes(state.sources.platformEvm?.status) ? Math.min(failures + 1, 3) : 0;
    } finally {
      busy = false;
      nextAttempt = Date.now() + 6e4 * 2 ** failures;
    }
  }
  const artwork = createArtwork({ env, directory: path3.join(dir, "artwork"), getRows: () => state.rows, getCachedArtwork, metadataAddress, fetcher, getAccounts: async (addresses, encoding) => {
    const data = await json(env.PURRLYSIUM_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getMultipleAccounts", params: [addresses, { encoding, commitment: "confirmed" }] }) });
    return data.result.value;
  } });
  const snapshot = () => {
    const sources = Object.fromEntries(Object.entries(state.sources).map(([name, s]) => [name, s.checkedAt && Date.now() - Date.parse(s.checkedAt) > 6e5 ? { ...s, status: "stale", complete: false } : s]));
    return { version: 1, rows: mergeMarkets(state.rows).map((row) => ({ ...row, image: imageRoute(row) })), artwork: artwork.status(), sources, launches: state.launches, checkedAt: state.checkedAt || null, partial: true, complete: false, refreshing: busy, coverageNote: "Platform provenance first, then ecosystem and bounded wider markets. " + sourceNote(sources) };
  };
  let timer;
  if (autoStart) {
    const run = () => refresh().catch(() => {
      state.sources.persistence = { status: "unavailable", complete: false, error: "Discovery snapshot could not be saved" };
    });
    timer = setTimeout(() => {
      void run();
      timer = setInterval(() => void run(), 6e4);
      timer.unref?.();
    }, 2e3);
    timer.unref?.();
  }
  return { snapshot, refresh, exportState: () => state, artwork, close: () => clearInterval(timer) };
}
export {
  createMarketDiscovery,
  recordPumpBuild
};
/*! Bundled license information:

@noble/hashes/esm/utils.js:
  (*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) *)
*/
