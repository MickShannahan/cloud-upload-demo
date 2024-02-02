import { app} from '@azure/functions'
import { Auth0Provider} from '@bcwdev/auth0provider'
import  multipart from 'parse-multipart'
import { BlobServiceClient } from '@azure/storage-blob';
import sharp from 'sharp'

app.http('imageSandwich', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try{
        const audience = process.env.AUTH0_AUDIENCE
        const domain = process.env.AUTH0_DOMAIN
        const clientId = process.env.AUTH0_CLIENT_ID
        Auth0Provider.configure({audience, domain, clientId})
        const token = request.headers.get('authorization')
        if(!token) throw new Error('Not logged in')
        const userInfo = await Auth0Provider.getUserInfoFromBearerToken(token)
        context.log(userInfo)


        const body = await request.arrayBuffer()
        const bodyBuffer = Buffer.from(body)
        const boundary = multipart.getBoundary(request.headers.get('Content-Type'))
        context.log('bound', boundary)

        const files = multipart.Parse(bodyBuffer, boundary)
        
        if(files.length <= 0) throw new Error("no uploaded files, ya goober!")
        
        const file = files[0]
        context.log('[FILE]',file)
        const fileName = file.filename
        const fileType = file.type

        const kbSize = (file.data.byteLength / 1024)
        let imageWidth, imageHeight

            // Image processing

        const imageBuffer = Buffer.from(file.data)

        const shrink = await sharp(imageBuffer)
                            .metadata()
                            .then(({width, height})=> {
                                imageWidth = width
                                imageHeight = height
                            return sharp(imageBuffer)
                            .toBuffer()
                          })

        const jpg = await sharp(shrink)
                          .resize(Math.round(imageWidth * .25))
                          .jpeg({quality: 70, chromaSubsampling: '4:4:4'})
                          .toBuffer()

        const webp = await sharp(imageBuffer)
                                .webp({quality: 20, nearLossless: true})
                                .toBuffer()
                              


        const blobStorage = BlobServiceClient.fromConnectionString(process.env.AzureWebJobsStorage)
        const container = blobStorage.getContainerClient('images')

        const folder = userInfo.id
        const blockBlob = container.getBlockBlobClient(`${folder}/${fileName}`)
        const blobOptions = {blobHTTPHeaders: {blobContentType: fileType, blobCacheControl: 'max-age=36000'}}
        const jpgOptions = {blobHTTPHeaders: {blobContentType: 'image/jpg', blobCacheControl: 'max-age=36000'}}
        await blockBlob.upload(file.data, file.data.length, blobOptions)
        const webpOptions =  { blobHTTPHeaders: {blobContentType: 'image/webp', blobCacheControl: 'max-age=36000'}}

        const jpgBlob = container.getBlockBlobClient(`${folder}/thumbnails/${fileName}`)
        await jpgBlob.upload(jpg, jpg.length, jpgOptions)

        const webpBlob = container.getBlockBlobClient(`${folder}/webps/${fileName}`)
        webpBlob.upload(webp, webp.length, webpOptions)

        const webpKb = webp.length / 1024

        const payload = {
            fileName,
            url: blockBlob.url,
            thumbnail : jpgBlob.url,
            webp: webpBlob.url,
            webpKb,
            originalSize: kbSize,
            imageWidth,
            imageHeight
            }
        
        return { 
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json'
            }
        };
    }catch(error){
        context.error(error)
        return{
            status: error.status || 400,
            body: '[🥪Bad sandwich] ' + error.message
        }
    }
    }
});
