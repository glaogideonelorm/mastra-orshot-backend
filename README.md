# Mastra + Orshot Backend

A backend service that processes landing page briefs and renders them using Orshot's API.

## What it does

1. **JSON Processing**: Converts/validates structured JSON modifications using Zod
2. **Orshot Integration**: Calls Orshot's Render-from-Template API to generate images/PDFs
3. **HTTP API**: Simple REST endpoint testable with `curl`

## Quick Start

```bash
npm install
cp .env.example .env  # Add your ORSHOT_API_KEY and ORSHOT_TEMPLATE_ID
npm run dev
```

## API Usage

### Landing Page Generation (Studio Template)

```bash
curl -X POST http://localhost:3000/a2a/agent/landing \
  -H "Content-Type: application/json" \
  -d '{"message":"Create a website landing page for a gym app with inspiring quotes and dynamic neon vibes. 3 features, bold CTA.","format":"png"}'
```

### Website Screenshot (Library Template)

```bash
curl -X POST http://localhost:3000/a2a/agent/landing \
  -H "Content-Type: application/json" \
  -d '{"message":"Take a screenshot of https://vercel.com","format":"png"}'
```

## Telex Integration

This service is fully compatible with Telex using the "node option". Telex nodes can POST to your agent endpoint to generate landing page mocks.

### Agent Discovery

Your agent advertises itself via a standard Agent Card at `/.well-known/agent.json`:

```bash
curl https://your-domain.com/.well-known/agent.json
```

```json
{
  "name": "Landing Mock Agent",
  "version": "1.0.0",
  "description": "Turns a plain-English brief into an Orshot-rendered landing mock (image/PDF).",
  "url": "https://your-domain.com/a2a",
  "capabilities": { "streaming": false, "pushNotifications": false },
  "defaultInputModes": ["text/plain"],
  "defaultOutputModes": ["application/json"],
  "authentication": { "type": "apiKey", "in": "header", "name": "X-API-Key" }
}
```

### Telex Node Configuration

**A2A Endpoint:** `POST /a2a`

**Supported Request Formats:**

1. **JSON-RPC Format** (Telex standard):

```json
{
  "jsonrpc": "2.0",
  "id": "unique-id",
  "method": "message/send",
  "params": {
    "message": {
      "kind": "message",
      "role": "user",
      "parts": [
        { "kind": "text", "text": "Create a landing page for a SaaS product" }
      ]
    }
  }
}
```

2. **Simple Node Format** (backward compatibility):

```json
{
  "action": "renderLanding",
  "payload": {
    "message": "Create a landing page for a SaaS product",
    "format": "png"
  }
}
```

**Headers:**

```
Content-Type: application/json
```

**Note:** No authentication is required. The `/a2a` endpoint is open for Telex A2A integration.

**Response Format:**

```json
{
  "ok": true,
  "type": "content",
  "contentType": "image",
  "url": "https://storage.orshot.com/cloud/...",
  "meta": {
    "format": "png",
    "templateId": "1340",
    "templateType": "studio",
    "modifications": { ... }
  }
}
```

### Example Telex Integration

1. **Set up ngrok** (or similar) to expose your local server:

   ```bash
   npx ngrok http 3000
   # Use the ngrok URL (e.g., https://abc123.ngrok.io) in your Telex node config
   ```

2. **Configure your Telex node:**
   - **Method:** POST
   - **URL:** `https://your-ngrok-url.ngrok.io/a2a`
   - **Headers:** `Content-Type: application/json`
   - **Body:** `{ "action": "renderLanding", "payload": { "message": "{{user_message}}" } }`

3. **Test in Telex channel:**
   ```
   User: Create a landing page for my gym business
   Telex: [Shows generated image URL]
   ```

### Response Format

**Screenshot Response:**

```json
{
  "ok": true,
  "type": "content",
  "contentType": "image",
  "url": "https://storage.orshot.com/cloud/...",
  "meta": {
    "format": "png",
    "templateId": "website-screenshot",
    "templateType": "screenshot",
    "modifications": {
      "websiteUrl": "https://github.com"
    }
  }
}
```

**Landing Page Response:**

```json
{
  "ok": true,
  "type": "content",
  "contentType": "image",
  "url": "https://storage.orshot.com/cloud/...",
  "meta": {
    "format": "png",
    "templateId": "tpl_your_template_id",
    "templateType": "landing",
    "modifications": {
      "headline": "Transform Your Fitness Journey",
      "primaryCta": "Start Your Journey",
      "features": [...],
      "quotes": [...],
      "palette": "dark-neon"
    }
  }
}
```

## Architecture

- **Schema** (`src/lib/schema.ts`): Zod union schema supporting both screenshot and landing templates
- **Routes** (`src/routes/a2a.ts`): HTTP endpoint with smart routing, prompt analysis, validation, and Orshot integration
- **Server** (`src/server.ts`): Express HTTP server with dotenv configuration
- **Env** (`src/env.ts`): Environment configuration with validation

## Template Routing

The system automatically routes between two template types:

### Screenshot Templates

- **Trigger**: Prompts containing URLs or screenshot requests
- **Template**: `ORSHOT_TEMPLATE_ID_SCREENSHOT` (website-screenshot)
- **Modifications**: `{ websiteUrl: "https://..." }`

### Landing Page Templates

- **Trigger**: Creative prompts for landing pages
- **Template**: `ORSHOT_TEMPLATE_ID_LANDING` (your Studio template)
- **Modifications**: `{ headline, primaryCta, features[], quotes[], palette, ... }`

## Key Features

- ✅ **Dual Template Support**: Automatic routing between screenshot and landing templates
- ✅ **LLM Processing**: Mastra agent converts natural language to structured modifications
- ✅ **Timeouts & Retries**: 30s timeout, 1 retry with exponential backoff
- ✅ **Schema Validation**: Zod union validation for type safety
- ✅ **Error Handling**: Secure error responses without leaking secrets
- ✅ **Environment Config**: Proper dotenv loading and validation
- ✅ **ES Modules**: Full TypeScript ES module support

## Environment Variables

- `ORSHOT_API_KEY`: Your Orshot API key
- `ORSHOT_TEMPLATE_ID_LANDING`: Studio template ID for landing page generation (numeric, e.g., `1340`)
- `ORSHOT_TEMPLATE_ID_SCREENSHOT`: Screenshot template ID (default: `website-screenshot`)
- `PORT`: Server port (default: 3000)

## Development

```bash
npm run dev    # Development with hot reload
npm run build  # TypeScript compilation
npm run start  # Production server
```

## Integration Notes

- Template fields in Orshot Studio must match the `ModsSchema` structure
- Supports both image formats (`png`, `jpg`, `webp`) and PDF output
- API responses include direct URLs to rendered assets
- Currently uses mock modifications - integrate with LLM for dynamic content generation

## Current Implementation Status

✅ **Working**: Dual template routing, timeouts, retries, schema validation, real API integration
🎉 **Both template types fully functional!**

## Template Status

### ✅ **Screenshot Templates** (Library API)

- **Endpoint**: `POST /v1/generate/{images|pdfs}`
- **Template ID**: `"website-screenshot"` (string)
- **Trigger**: Prompts with URLs or screenshot keywords
- **Example**: `"Take a screenshot of https://github.com"`

### ✅ **Landing Page Templates** (Studio API)

- **Endpoint**: `POST /v1/studio/render`
- **Template ID**: `1340` (numeric)
- **Trigger**: Creative landing page prompts
- **Example**: `"Create a gym landing page with neon theme"`

## Setup Instructions

✅ **Both template types are already configured and working!**

1. **Screenshot Templates**: Already working with Orshot's library template
2. **Studio Templates**: Your template `1340` is connected and functional

## Test Commands

**Screenshot (Library API):**

```bash
curl -X POST http://localhost:3000/a2a/agent/landing \
  -H "Content-Type: application/json" \
  -d '{"message":"Take a screenshot of https://react.dev"}'
```

**Landing Page (Studio API):**

```bash
curl -X POST http://localhost:3000/a2a/agent/landing \
  -H "Content-Type: application/json" \
  -d '{"message":"Create a SaaS landing page with modern theme"}'
```

## API Response Example

```json
{
  "ok": true,
  "type": "content",
  "contentType": "image",
  "url": "https://storage.orshot.com/cloud/w-1527/renders/images/xxxxx.png",
  "meta": {
    "format": "png",
    "templateId": "website-screenshot",
    "modifications": {
      "websiteUrl": "https://github.com"
    }
  }
}
```
