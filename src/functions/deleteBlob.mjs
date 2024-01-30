import { app} from '@azure/functions'
import { BlobServiceClient } from '@azure/storage-blob'
import { Auth0Provider } from '@bcwdev/auth0provider/lib/Auth0Provider.js'

app.http('deleteBlob', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  handler: async function (request, context) {
    try {
      const audience = process.env.AUTH0_AUDIENCE
      const domain = process.env.AUTH0_DOMAIN
      const clientId = process.env.AUTH0_CLIENT_ID
      Auth0Provider.configure({audience,clientId,domain})
      // get logged in user's information from bearer token (this uses the Auth0 ecosystem we use for all other user info)
      const token  = request.headers.get('authorization')
      if(!token) throw new Error("Not Authorized") // no token? no request for you!
      const userInfo = await Auth0Provider.getUserInfoFromBearerToken(token)

      const blobStorage = BlobServiceClient.fromConnectionString(process.env.AzureWebJobsStorage)
      const folder = userInfo.id
      const fileName = request.query.get('fileName')

      if(!fileName) throw new Error('Must Specify File to Delete')

      const container = blobStorage.getContainerClient('demo')
      const blob = container.getBlockBlobClient(`${folder}/${fileName}`)
      await blob.deleteIfExists({deleteSnapshots: 'include'})

      const payload = `${fileName} removed"`
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
})