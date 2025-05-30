// Minimal server for development
import express from 'express'
import path from 'path'

const app = express()
const PORT = process.env.PORT || 5000

app.use(express.json())
app.use(express.static('dist/public'))

app.get('*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'dist/public/index.html'))
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
