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
 * Helper function to simulate random delay
 */
const randomDelay = (min, max) => {
  return new Promise(resolve => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    setTimeout(resolve, delay);
  });
};

/**
 * GET /files - Get list of files from S3
 * This is the REST endpoint function
 * Returns various response types with random execution times for testing metrics
 */
exports.getFiles = async (event) => {
  console.log('GET /files - Request:', JSON.stringify(event, null, 2));
  
  // Generate random scenario for testing different metrics
  // 70% success, 20% 4xx errors, 10% 5xx errors
  const random = Math.random();
  const scenario = random < 0.7 ? 'success' : random < 0.9 ? 'client_error' : 'server_error';
  
  // Random execution time: 10ms to 500ms for success, 5ms to 100ms for errors
  const delay = scenario === 'success' 
    ? Math.floor(Math.random() * 490) + 10  // 10-500ms
    : Math.floor(Math.random() * 95) + 5;    // 5-100ms
  
  await randomDelay(delay, delay);
  
  try {
    // Simulate different scenarios
    if (scenario === 'client_error') {
      // 4xx error - Bad Request (return HTTP error, not Lambda exception)
      // This will show up in API Gateway 4XXError metric, not Lambda Errors
      const errorType = Math.random() < 0.5 ? 400 : 404;
      return {
        statusCode: errorType,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: errorType === 400 ? 'Bad Request' : 'Not Found',
          message: `Simulated ${errorType} error for testing`
        })
      };
    }
    
    if (scenario === 'server_error') {
      // 5xx error - Internal Server Error
      // Throw exception to generate Lambda Error metric AND API Gateway 5XXError
      throw new Error('Simulated server error for testing');
    }
    
    // Success scenario - try to get files from S3
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
        bucket: BUCKET_NAME,
        executionTime: `${delay}ms`
      })
    };
  } catch (error) {
    console.error('Error listing files:', error);
    
    // If bucket doesn't exist, return empty list (success)
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
          message: 'Bucket does not exist yet',
          executionTime: `${delay}ms`
        })
      };
    }
    
    // Server error (5xx)
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Failed to list files',
        message: error.message,
        executionTime: `${delay}ms`
      })
    };
  }
};

/**
 * Event-based function - Processes SNS/EventBridge events
 * Returns various response types with random execution times for testing metrics
 */
exports.processEvent = async (event) => {
  console.log('Event received:', JSON.stringify(event, null, 2));
  
  // Generate random scenario for testing different metrics
  // 80% success, 20% errors
  const random = Math.random();
  const scenario = random < 0.8 ? 'success' : 'error';
  
  // Random execution time: 20ms to 300ms for success, 10ms to 200ms for errors
  const delay = scenario === 'success'
    ? Math.floor(Math.random() * 280) + 20  // 20-300ms
    : Math.floor(Math.random() * 190) + 10; // 10-200ms
  
  await randomDelay(delay, delay);
  
  try {
    // Handle SNS event
    if (event.Records && event.Records[0] && event.Records[0].EventSource === 'aws:sns') {
      const snsRecord = event.Records[0].Sns;
      const message = JSON.parse(snsRecord.Message);
      
      console.log('Processing SNS message:', message);
      
      // Simulate error scenario
      if (scenario === 'error') {
        throw new Error('Simulated event processing error for testing');
      }
      
      // Process the message
      const result = {
        eventType: 'sns',
        topicArn: snsRecord.TopicArn,
        messageId: snsRecord.MessageId,
        message: message,
        processedAt: new Date().toISOString(),
        executionTime: `${delay}ms`
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
      
      // Simulate error scenario
      if (scenario === 'error') {
        throw new Error('Simulated event processing error for testing');
      }
      
      const result = {
        eventType: 'eventbridge',
        source: event.source,
        detailType: event['detail-type'],
        detail: event.detail,
        processedAt: new Date().toISOString(),
        executionTime: `${delay}ms`
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
    if (scenario === 'error') {
      throw new Error('Simulated event processing error for testing');
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Event processed',
        event: event,
        executionTime: `${delay}ms`
      })
    };
  } catch (error) {
    console.error('Error processing event:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Failed to process event',
        message: error.message,
        executionTime: `${delay}ms`
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
