'use client'

import Image from "next/image";
import { useDropzone } from "react-dropzone"
import { PNG } from 'pngjs/browser'
import { useState } from 'react'
import { Generator } from "@/lib/generator";

export default function Home() {
  const onDrop = (files) => {
    setUploadedFiles(uploadedFiles.concat(files))
    files.forEach(file => {
      const fileReader = new FileReader()
      fileReader.addEventListener('loadend', (event) => {
        const png = new PNG({filterType: 4}).parse(event.target.result, (error, image) => {
          if (error) {
            console.error(error)
            return
          }

          const newPng = Generator.generate(image)
          const base64 = PNG.sync.write(newPng).toString('base64')
          const imageData = {
            base64: base64,
            width: newPng.width,
            height: newPng.height
          }
          setImages(images.concat(imageData))
        })
      })
      fileReader.readAsArrayBuffer(file)
    })
  }

  const { getRootProps, getInputProps } = useDropzone({ onDrop })
  const [ uploadedFiles, setUploadedFiles ] = useState([])
  const [ images, setImages ] = useState([])

  const renderImage = (image, index) => {
    const dataUri = 'data:image/png;base64,' + image.base64
    const key = `image-${index}`

    return (<>
      <div key={key}>
        <Image src={dataUri} alt='' width={image.width} height={image.height} />
      </div>
    </>)
  }

  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        <div {...getRootProps()} style={{ border: "1px dashed #ff7f7f", width: "100%", height: 150 }}>
          <input {...getInputProps()} />
          <p>ここにファイルをドラッグ&ドロップしてください。</p>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {images.map(renderImage)}
        </div>
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
      </footer>
    </div>
  );
}
