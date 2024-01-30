import { app } from '@azure/functions'
import multipart from 'parse-multipart'
import { Auth0Provider } from '@bcwdev/auth0provider';
import { BlobServiceClient } from '@azure/storage-blob';

app.http('imageUpload', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async function (request, context){
try {
    // STUB AUTHORIZE
    // configure keys with provider (Key Values go in local.settings for the project, and configuration settings of the function in Azure portal)
    const audience = process.env.AUTH0_AUDIENCE
    const domain = process.env.AUTH0_DOMAIN
    const clientId = process.env.AUTH0_CLIENT_ID
    Auth0Provider.configure({audience,clientId,domain})
    // get logged in user's information from bearer token (this uses the Auth0 ecosystem we use for all other user info)
    const token = request.headers.get('authorization')// get token from the headers of the request
    if(!token) throw new Error("Not Authorized") // no token? no request for you!
    // Get userInfo from Auth0, using that token
    const userInfo = await Auth0Provider.getUserInfoFromBearerToken(token)

    // REVIEW 🧪 can you see the user information in the console?
    context.log('[USER]',userInfo)
    
    // STUB GET FILE
    // Pull file from request body using multipart library | An alternative method would be to have the client send a buffer instead, this reduces work needed on the client side however
    const body = await request.arrayBuffer() // there are different methods to pull the body's data off (json, text, blob)
    const bodyBuffer = Buffer.from(body); // Buffers is how we convert the req.body into bytes
    const boundary = multipart.getBoundary(request.headers.get("Content-Type"))// This request type needs it's end defined (multipart will find the end for us)
    /* example of what network data looks like when received
    --abcde
        Content-Disposition: file; file="picture.jpg"
        content of jpg...
        --abcde */
    const files = multipart.Parse(bodyBuffer, boundary); // cut the file data out of the buffer using the boundary, returns []

    if(files.length <= 0) throw new Error("No File Attached") // if no parts were pulled out, then no files were attached
    const file = files[0]
    const fileName = file.filename
    const fileType = file.type
    //  REVIEW 🧪 can you see the file type and file name that you uploaded in the console?
    context.log('[FILE]',fileName, fileType, file)

    // NOTE get file size
    const kbSize = (file.data.byteLength / 1024)
    const mbSize = kbSize/1024
    
    //STUB SAVE IMAGE
    // connect to our Azure blob storage
    // AzureWbeJobStorage is stored in local.settings for project, and configuration settings in Azure portal)
    // This value can be retrieved from your storage account => Security + Networking => Access Keys => Connection String
    const blobStorage = BlobServiceClient.fromConnectionString(process.env.AzureWebJobsStorage)
    
    // This container needs to be created in the Azure storage account before hand (not bad practice to have a container per project)
    const container = blobStorage.getContainerClient('demo') // This could be a query passed through the post url (?container=project+name)
    const folder = userInfo.id // save user uploaded into user specific folders
    const blockBlob = container.getBlockBlobClient(`${folder}/${fileName}`) // Construct the blob data to send to blob storage
    const blobOptions = { blobHTTPHeaders: { blobContentType: fileType, blobCacheControl: 'max-age=36000' } } // construct the headers for the request to send the blob
    const uploadResponse = await blockBlob.upload(file.data, file.data.length, blobOptions) // upload the file to blob storage

    // REVIEW 🧪 pause and test with post-man. check to see if the file is now saved in your blob storage container, under your userId inside the Azure Portal
    
    // STUB RESPOND, 
    const payload = {
        fileName,
        url : blockBlob.url,
        fileSizeKb: kbSize
    }
    
    return {
        status: 200,
        body: JSON.stringify(payload),
        headers: {
            'content-type': 'application/json'
        }
    }
} catch (error) {
    context.error(error)
    return {
        status: error.status || 400,
        body:"[🌩️Error]"+ error.message,
    }
}
}

});