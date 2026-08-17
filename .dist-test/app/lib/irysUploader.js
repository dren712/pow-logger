"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseIrysPrivateKey = parseIrysPrivateKey;
exports.uploadEnvelopeToIrys = uploadEnvelopeToIrys;
const web3_js_1 = require("@solana/web3.js");
const canonicalMessage_1 = require("./canonicalMessage");
let cachedUploaderFn = null;
let cachedSolanaFn = null;
async function getIrysModules() {
    if (cachedUploaderFn && cachedSolanaFn) {
        return { UploaderFn: cachedUploaderFn, SolanaFn: cachedSolanaFn };
    }
    const irysUploadObj = (await Promise.resolve().then(() => __importStar(require('@irys/upload'))));
    const irysSolanaObj = (await Promise.resolve().then(() => __importStar(require('@irys/upload-solana'))));
    cachedUploaderFn = (irysUploadObj.Uploader || irysUploadObj.default || irysUploadObj);
    cachedSolanaFn = irysSolanaObj.Solana || irysSolanaObj.default || irysSolanaObj;
    return { UploaderFn: cachedUploaderFn, SolanaFn: cachedSolanaFn };
}
/**
 * Deterministically parses a Solana secret key from environment variable string.
 * Supports standard JSON Array (64-byte secret key / 32-byte seed) or Base58 encoded string.
 */
function parseIrysPrivateKey(privateKeyEnv) {
    let cleaned = privateKeyEnv.trim();
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        cleaned = cleaned.slice(1, -1).trim();
    }
    cleaned = cleaned.replace(/\\n/g, '').trim();
    // 1. JSON Array format [123, 45, ...]
    if (cleaned.startsWith('[')) {
        try {
            const parsed = JSON.parse(cleaned);
            if (Array.isArray(parsed)) {
                const bytes = new Uint8Array(parsed.map(Number));
                if (bytes.length === 64)
                    return bytes;
                if (bytes.length === 32)
                    return web3_js_1.Keypair.fromSeed(bytes).secretKey;
                throw new Error(`Invalid JSON key length (${bytes.length} bytes). Expected 64-byte secret key or 32-byte seed.`);
            }
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : 'Invalid JSON format';
            throw new Error(`Failed to parse IRYS_PRIVATE_KEY as JSON array: ${msg}`);
        }
    }
    // 2. Base58 encoded string format
    try {
        const decoded = (0, canonicalMessage_1.decodeBase58)(cleaned);
        if (decoded.length === 64)
            return decoded;
        if (decoded.length === 32)
            return web3_js_1.Keypair.fromSeed(decoded).secretKey;
        throw new Error(`Invalid Base58 key length (${decoded.length} bytes). Expected 64 or 32 bytes.`);
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : 'Invalid Base58 format';
        throw new Error(`Failed to parse IRYS_PRIVATE_KEY as Base58 string: ${msg}`);
    }
}
async function uploadEnvelopeToIrys(structuredEnvelope, tags) {
    const privateKey = process.env.IRYS_PRIVATE_KEY;
    if (!privateKey) {
        const msg = 'IRYS_PRIVATE_KEY is not configured in Vercel Environment Variables';
        console.warn('[PROVN Irys]', msg);
        return { success: false, error: msg };
    }
    let parsedKey;
    try {
        parsedKey = parseIrysPrivateKey(privateKey);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Invalid key';
        console.error('[PROVN Irys Key Parse Error]', msg);
        return { success: false, error: msg };
    }
    const { UploaderFn, SolanaFn } = await getIrysModules();
    if (typeof UploaderFn !== 'function' || !SolanaFn) {
        const msg = 'Irys SDK module exports unresolved in serverless bundle';
        console.error('[PROVN Irys]', msg);
        return { success: false, error: msg };
    }
    try {
        const uploader = await UploaderFn(SolanaFn).withWallet(parsedKey);
        const uploadReceipt = await uploader.upload(structuredEnvelope, { tags });
        if (uploadReceipt && uploadReceipt.id) {
            console.log(`[PROVN Irys] Successfully archived to Arweave ID: ${uploadReceipt.id}`);
            return { success: true, irysTxId: uploadReceipt.id };
        }
        return { success: false, error: 'Upload returned empty receipt ID' };
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('[PROVN Irys Upload Failed]:', errorMsg);
        return { success: false, error: errorMsg };
    }
}
