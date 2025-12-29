/**
 * Lambda Sample Application
 * 1. GET REST endpoint (via API Gateway)
 * 2. Event-based function (SNS/EventBridge)
 */

const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

// AWS_REGION is automatically set by Lambda runtime
// For local testing, fallback to us-east-1
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const s3Client = new S3Client({ region });
const snsClient = new SNSClient({ region });

const BUCKET_NAME = process.env.BUCKET_NAME || 'poc-lambda-bucket';
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN || '';

/**
 * GET /files - Get list of files from S3
 * This is the REST endpoint function
 */
exports.getFiles = async (event) => {
  console.log('GET /files - Request:', JSON.stringify(event, null, 2));
  
  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      MaxKeys: 100
    });
    
    const result = await s3Client.send(command);
    
    const files = (result.Contents || []).map(item => ({
      key: item.Key,
      size: item.Size,
      lastModified: item.LastModified,
      etag: item.ETag
    }));
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: files,
        count: files.length,
        bucket: BUCKET_NAME
      })
    };
  } catch (error) {
    console.error('Error listing files:', error);
    
    // If bucket doesn't exist, return empty list
    if (error.name === 'NoSuchBucket') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          data: [],
          count: 0,
          message: 'Bucket does not exist yet'
        })
      };
    }
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to list files',
        message: error.message
      })
    };
  }
};

/**
 * Event-based function - Processes SNS/EventBridge events
 */
exports.processEvent = async (event) => {
  console.log('Event received:', JSON.stringify(event, null, 2));
  
  try {
    // Handle SNS event
    if (event.Records && event.Records[0] && event.Records[0].EventSource === 'aws:sns') {
      const snsRecord = event.Records[0].Sns;
      const message = JSON.parse(snsRecord.Message);
      
      console.log('Processing SNS message:', message);
      
      // Process the message
      const result = {
        eventType: 'sns',
        topicArn: snsRecord.TopicArn,
        messageId: snsRecord.MessageId,
        message: message,
        processedAt: new Date().toISOString()
      };
      
      console.log('Event processed successfully:', result);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          data: result
        })
      };
    }
    
    // Handle EventBridge event
    if (event.source && event['detail-type']) {
      console.log('Processing EventBridge event:', event);
      
      const result = {
        eventType: 'eventbridge',
        source: event.source,
        detailType: event['detail-type'],
        detail: event.detail,
        processedAt: new Date().toISOString()
      };
      
      console.log('Event processed successfully:', result);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          data: result
        })
      };
    }
    
    // Handle direct invocation
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Event processed',
        event: event
      })
    };
  } catch (error) {
    console.error('Error processing event:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Failed to process event',
        message: error.message
      })
    };
  }
};

/**
 * Main Lambda handler - Routes to appropriate function
 */
exports.handler = async (event, context) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  console.log('Context:', JSON.stringify(context, null, 2));
  
  // Check if it's an API Gateway event
  if (event.httpMethod || event.requestContext) {
    const httpMethod = event.httpMethod || event.requestContext?.http?.method;
    const path = event.path || event.requestContext?.path;
    
    if (httpMethod === 'GET' && path === '/files') {
      return await exports.getFiles(event);
    }
  }
  
  // Otherwise, treat as event-based invocation
  return await exports.processEvent(event);
};

// test