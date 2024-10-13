import { PNG } from 'pngjs/browser'

class ImageAnalyzer {
  constructor(png) {
    this.png = png
  }

  initialize() {
    this.threshold = [0, 1, 2].map(offset => {
      const colors = this.corners().map(arr => arr[offset])
      return Math.max(...colors)
    })

    // top
    const threshold = this.threshold
    const png = this.png
    const isOpaque = (color) => this.isOpaque(color)

    const mapColor = (x, y) => {
      const index = (png.width * y + x) * 4
      return [0, 1, 2].map(offset => png.data[index + offset])
    }
    const top = [...Array(png.height).keys()].find(y => {
      const colors = [...Array(png.width).keys()].map(x => mapColor(x, y))
      return colors.some(isOpaque)
    })
    const left = [...Array(png.width).keys()].find(x => {
      const colors = [...Array(png.width).keys()].map(y => mapColor(x, y))
      return colors.some(isOpaque)
    })
    const bottom = [...Array(png.height).keys()].reverse().find(y => {
      const colors = [...Array(png.width).keys()].map(x => mapColor(x, y))
      return colors.some(isOpaque)
    })
    const right = [...Array(png.width).keys()].reverse().find(x => {
      const colors = [...Array(png.width).keys()].map(y => mapColor(x, y))
      return colors.some(isOpaque)
    })

    this.trimming = {
      left: left,
      top: top,
      right: right,
      bottom: bottom
    }
  }

  corners() {
    const colorMargin = 5
    const png = this.png
    return [
      0,
      png.width - 1,
      png.width * (png.height - 1),
      png.width * (png.height - 1) + png.width - 1
    ].map(pos => {
      const index = pos * 4
      return [
        png.data[index] + colorMargin,     //r
        png.data[index + 1] + colorMargin, //g
        png.data[index + 2] + colorMargin  //b
      ]
    })
  }

  trimmingRect() {
    return {
      width: this.trimming.right - this.trimming.left,
      height: this.trimming.bottom - this.trimming.top
    }
  }

  isOpaque(color) {
    const threshold = this.threshold
    return [0, 1, 2].some(offset => color[offset] > threshold[offset])
  }
}

class Trimmer {
  constructor(imageAnalyzer) {
    this.imageAnalyzer = imageAnalyzer
  }

  call(newfile) {
    const rect = this.imageAnalyzer.trimmingRect()
    const trimming = this.imageAnalyzer.trimming
    const png = this.imageAnalyzer.png
    png.bitblt(newfile, trimming.left, trimming.top, rect.width, rect.height, 0, 0)
  }
}

class Filler {
  constructor(imageAnalyzer) {
    this.imageAnalyzer = imageAnalyzer
  }

  call(newfile) {
    const source = Buffer.from(newfile.data)
    const rect = this.imageAnalyzer.trimmingRect()
    const trimming = this.imageAnalyzer.trimming

    const posToIndex = (x, y) => (rect.width * y + x) * 4
    const mapColor = (x, y) => {
      const index = posToIndex(x, y)
      return [0, 1, 2].map(offset => source[index + offset])
    }
    const makeTransparent = (x, y) => {
      const index = posToIndex(x, y)
      newfile.data[index]     = 0
      newfile.data[index + 1] = 0
      newfile.data[index + 2] = 0
      newfile.data[index + 3] = 0
    }

    // left->right
    for(const y of Array(rect.height).keys()) {
      for(const x of Array(rect.width).keys()) {
        const color = mapColor(x, y)
        if( this.imageAnalyzer.isOpaque(color) ) { break }

        makeTransparent(x, y)
      }
    }

    // top->bottom
    for(const x of Array(rect.width).keys()) {
      for(const y of Array(rect.height).keys()) {
        const color = mapColor(x, y)
        if( this.imageAnalyzer.isOpaque(color) ) { break }

        makeTransparent(x, y)
      }
    }

    // right->left
    for(const y of Array(rect.height).keys()) {
      for(const x of [...Array(rect.width).keys()].reverse()) {
        const color = mapColor(x, y)
        if( this.imageAnalyzer.isOpaque(color) ) { break }

        makeTransparent(x, y)
      }
    }

    // bottom->top
    for(const x of Array(rect.width).keys()) {
      for(const y of [...Array(rect.height).keys()].reverse()) {
        const color = mapColor(x, y)
        if( this.imageAnalyzer.isOpaque(color) ) { break }

        makeTransparent(x, y)
      }
    }
  }
}

export class Generator {
  static generate(png) {
    const imageAnalyzer = new ImageAnalyzer(png)
    imageAnalyzer.initialize()

    const newfile = new PNG({...imageAnalyzer.trimmingRect(), alpha: true});

    const trimmer = new Trimmer(imageAnalyzer)
    trimmer.call(newfile)

    const filler = new Filler(imageAnalyzer)
    filler.call(newfile)

    return newfile
  }
}