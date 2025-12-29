# Lambda Sample Application - POC

Sample Lambda application with:
1. GET REST endpoint (via API Gateway): `/files`
2. Event-based function (SNS/EventBridge): `processEvent`

## Functions

### 1. REST Endpoint Function
- **Handler**: `handler.getFiles`
- **Endpoint**: `GET /files`
- **Purpose**: Lists files from S3 bucket
- **Integration**: API Gateway

### 2. Event-Based Function
- **Handler**: `handler.processEvent`
- **Trigger**: SNS topic or EventBridge
- **Purpose**: Processes events from SNS/EventBridge

## Local Development

### Prerequisites

- Node.js 18+
- AWS CLI configured
- Serverless Framework (required for deployment)

### Install Serverless Framework

```bash
# Install globally
npm install -g serverless

# Verify installation
serverless --version
# Should show: Framework Core: 3.x.x

# If you get "No version found for 3" error, see TROUBLESHOOTING.md
```

### Setup

```bash
# Install dependencies
npm install

# Install Serverless Framework (optional)
npm install -g serverless
```

### Testing Locally

```javascript
// test-handler.js
const handler = require('./handler');

// Test GET endpoint
handler.getFiles({}).then(console.log);

// Test event processor
handler.processEvent({
  source: 'test.source',
  'detail-type': 'Test Event',
  detail: { message: 'Hello World' }
}).then(console.log);
```

## Deployment to AWS

### Option 1: Using Serverless Framework

```bash
# Deploy
serverless deploy

# Deploy to specific stage
serverless deploy --stage prod

# Remove
serverless remove
```

### Option 2: Manual Deployment

1. Create Lambda function via AWS Console
2. Upload handler.js as zip
3. For REST endpoint: Create API Gateway and integrate
4. For event function: Configure SNS/EventBridge trigger
5. Set environment variables

## Configuration for PR Metrics

The application is configured to work with PR Metrics Comparison:
- Lambda function with API Gateway integration
- Event-based Lambda function
- Standard naming patterns

## Environment Variables

- `BUCKET_NAME` - S3 bucket name (default: `lambda-sample-app-dev-bucket`)
- `SNS_TOPIC_ARN` - SNS topic ARN (auto-configured by Serverless)
- `AWS_REGION` - AWS region (default: `us-east-1`)

## Testing

### Test REST Endpoint

After deployment:

```bash
# Get API Gateway URL from deployment output
API_URL="https://xxxxx.execute-api.us-east-1.amazonaws.com/dev"

# GET files
curl $API_URL/files
```

### Test Event Function

```bash
# Publish to SNS topic
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:123456789012:poc-lambda-topic-dev \
  --message '{"test": "message"}'

# Or invoke directly
aws lambda invoke \
  --function-name lambda-sample-app-dev-event-processor \
  --payload '{"source":"test","detail-type":"Test Event","detail":{"message":"Hello"}}' \
  response.json
```

## Resources Created

- S3 Bucket: `lambda-sample-app-{stage}-bucket`
- SNS Topic: `poc-lambda-topic-{stage}`
- Lambda Functions:
  - `lambda-sample-app-{stage}-api` (REST endpoint)
  - `lambda-sample-app-{stage}-event-processor` (Event handler)

