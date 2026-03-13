# 🚀 Deployment Instructions for Vercel

## Current Status

✅ Code updated with local WASM configuration
✅ WASM files copied to `public/wasm/`
✅ Build successful locally
⏳ Ready to deploy to Vercel

## What Was Fixed

### Problem
```
ERR_UNSUPPORTED_ESM_URL_SCHEME: Only URLs with a scheme in: file and data are supported
```

Node.js runtime cannot load WASM from HTTPS CDN.

### Solution
1. Copy WASM files to `public/wasm/` (done automatically in postinstall)
2. Configure transformers.js to use local path: `wasmPaths = '/wasm/'`
3. Next.js serves WASM as static assets

## Deployment Steps

### 1. Commit and Push Changes

```bash
git add .
git commit -m "fix: Use local WASM files for Node.js runtime compatibility"
git push
```

### 2. Vercel Will Automatically:

1. Run `pnpm install`
2. Execute `postinstall` script → copies WASM files
3. Run `pnpm run build`
4. Deploy with WASM files in `public/wasm/`

### 3. Verify Deployment

Check logs for:
```
[Embeddings] Configuring WASM backend...
[Embeddings] WASM configuration set:
[Embeddings] - wasmPaths: /wasm/
```

## Expected Behavior

### Before (Error)
```
Error: no available backend found. ERR: [cpu] Error [ERR_UNSUPPORTED_ESM_URL_SCHEME]
```

### After (Success)
```
[Embeddings] Initializing bge-small-en model (384-dim) with WASM backend...
[Embeddings] ✅ bge-small-en model ready (WASM)
```

## Files That Will Be Deployed

### Static Assets (public/wasm/)
- `ort-wasm-simd-threaded.wasm`
- `ort-wasm-simd-threaded.asyncify.wasm`
- `ort-wasm-simd-threaded.jsep.wasm`
- `ort-wasm-simd-threaded.jspi.wasm`

These files are served at: `https://your-domain.vercel.app/wasm/`

### Configuration Files
- `lib/embeddings/server-dual.ts` - Uses `/wasm/` path
- `lib/embeddings/edge.ts` - Uses `/wasm/` path
- `scripts/copy-wasm-files.js` - Copies WASM files
- `package.json` - Includes postinstall script

## Troubleshooting

### If WASM files are missing on Vercel:

1. Check build logs for:
   ```
   ✅ Successfully copied 4 WASM files to public/wasm/
   ```

2. Verify `postinstall` script ran:
   ```bash
   > docs-bridge-crawler@1.0.0 postinstall
   > node scripts/create-sharp-stub.js && node scripts/copy-wasm-files.js
   ```

3. Check if files are in build output:
   ```
   public/wasm/*.wasm
   ```

### If still getting ESM URL error:

1. Check that `wasmPaths` is set to `/wasm/` (not CDN URL)
2. Verify WASM files are accessible at `https://your-domain.vercel.app/wasm/ort-wasm-simd-threaded.wasm`
3. Check Next.js is serving static files from `public/`

## Key Configuration

### package.json
```json
{
  "dependencies": {
    "onnxruntime-web": "^1.20.1"
  },
  "scripts": {
    "postinstall": "node scripts/create-sharp-stub.js && node scripts/copy-wasm-files.js"
  }
}
```

### lib/embeddings/server-dual.ts
```typescript
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = '/wasm/';  // Local path, not CDN
  env.backends.onnx.wasm.proxy = false;
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.wasm.simd = true;
}
```

## Success Criteria

✅ Build completes without errors
✅ WASM files copied to public/wasm/
✅ Crawler worker processes documents
✅ Embeddings generated successfully
✅ No ESM URL scheme errors

## Next Steps After Deployment

1. Monitor first crawler execution
2. Check for successful embedding generation
3. Verify documents are saved with embeddings
4. Confirm no memory or timeout issues

---

**Note**: The old deployment showing errors is using the previous code. After pushing these changes and redeploying, the errors should be resolved.
