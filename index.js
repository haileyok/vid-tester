require('dotenv').config()

const {exec} = require('child_process')
const fs = require('fs').promises
const {BskyAgent} = require('@atproto/api')

const {BSKY_USERNAME, BSKY_PASSWORD, SLACK_WEBHOOK_URL} = process.env

const fileName = "output.mp4"
const cmd = `ffmpeg -f lavfi -i nullsrc=s=1280x720 -filter_complex "geq=random(1)*255:128:128;aevalsrc=-2+random(0)" -t 5 ${fileName}`
const endpointUrl = 'https://video.bsky.app/xrpc/app.bsky.video.uploadVideo'

let agent = new BskyAgent({
  service: 'https://bsky.social'
})

const aud = 'did:web:lepista.us-west.host.bsky.network'

const createEndpointUrl = (did, fileName) => {
  const urlp = new URL(endpointUrl)
  urlp.searchParams.set('did', did)
  urlp.searchParams.set('name', fileName)
  return urlp.href
}

const execWrapper = (cmd) => {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        console.error(err)
        reject(err)
      }
      console.log(stdout)
      resolve()
    })
  })
}

const createVideo = async () => {
  console.log('Starting video creation...')
  await execWrapper(`rm -rf ${fileName}`)
  await execWrapper(cmd)
  console.log('Video created')
}

const login = async () => {
  await agent.login({
    identifier: BSKY_USERNAME,
    password: BSKY_PASSWORD,
  })
}

const uploadVideo = async () => {
  // upload the output.mp4 file
  //get the blob with node
  const data = await fs.readFile(fileName)
  const blob = new Blob([data], {type: 'video/mp4'})
  const url = createEndpointUrl(agent.session.did, fileName)
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'video/mp4',
    },
    body: blob,
  })
  const resJson = await res.json()
  return resJson
}

const notifySlack = async (message) => {
  const res = await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: message,
    }),
  })
  return res
}

const run = async () => {
  try {
    await createVideo()
  } catch(e) {
    console.error('Failed to create video')
    console.error(e)
    return
  }

  try {
    await login()
  } catch(e) {
    console.error('Failed to login')
    console.error(e)
    return
  }


  let res
  try {
    res = await uploadVideo()
  } catch(e) {
    console.error('Failed to upload video')
    console.error(e)
    await notifySlack('Failed to upload video!')
    return
  }

  const startTime = Date.now()



  const endTime = Date.now()

  const message = `Video uploaded successfully! Time taken to process: ${endTime - startTime}ms`
}

run()
