import fs from 'fs'

export const readFiles = (dirname: string): Promise<string[]> => {
    return new Promise((resolve, reject) => {
        fs.readdir(dirname, (err, filenames) => {
            if (err) {
                reject(err)
                return
            }

            resolve(filenames)
        })
    })
}
