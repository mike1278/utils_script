import minimist from "minimist"
import {prompt} from "~/utils/commandUtils"
import {
    createDirIfNotExists,
    getStats,
    isDirectory,
    moveFile,
    readFiles, walk
} from "~/utils/fileUtils"
import Exiftool from "exiftool-vendored"
import type {Tags} from "exiftool-vendored/dist/Tags"
import type Metadata from "~/types/metadata"
import type { FileType } from "~/types/metadata"
import fs from "fs"
import moment from "moment"
import cliProgress, {SingleBar} from "cli-progress"
import {ExifDateTime} from "exiftool-vendored/dist/ExifDateTime";

const exiftool = new Exiftool.ExifTool({taskTimeoutMillis: 5000})

const getFileType = (extension: string): FileType => {
    const image = ['jpg', 'jpeg', 'png', 'gif', 'tif', 'tiff', 'webp', 'dng']
    if (image.includes(extension)) {
        return 'image'
    }

    const video = ['mp4', 'mov', 'mkv', 'avi']
    if (video.includes(extension)) {
        return 'video'
    }

    const document = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'txt', 'csv']
    if (document.includes(extension)) {
        return 'document'
    }

    return 'other'
}

const whatsappRegexName = /IMG-\d{8}-WA\d{4}/
const facebookRegexName = /FB_\w{3}_\d*/

const getMomentFromExifTagDate = (date: ExifDateTime | string) => {
    if (date instanceof Exiftool.ExifDateTime) {
        return moment(date.toDate())
    }

    return moment(date, 'ddd DD MMM YYYY, HH:mm:ss')
}

const getCreationDate = (tags: Tags | null, stat: fs.Stats) => {
    if (!tags) {
        return moment(stat.ctime)
    }

    if (tags.DateTimeOriginal) {
        return getMomentFromExifTagDate(tags.DateTimeOriginal)
    }

    if (tags.CreateDate) {
        return getMomentFromExifTagDate(tags.CreateDate)
    }

    if (tags.TrackCreateDate) {
        return getMomentFromExifTagDate(tags.TrackCreateDate)
    }

    if (tags.ModifyDate) {
        return getMomentFromExifTagDate(tags.ModifyDate)
    }

    return moment(stat.ctime)
}

const readMetadata = async (path: string): Promise<Metadata> => {
    const file = path.split('/').pop()

    if (!file) {
        throw new Error('No file specified')
    }

    let metadataExiftool: Tags | null = null
    try {
        metadataExiftool = await exiftool.read(path)
    } catch (error) {
        console.log('Error reading file with exiftool: ', error)
    }

    let systemMetadata = fs.statSync(path)

    const extension = path.split('.').pop() ?? '';

    let date = getCreationDate(metadataExiftool, systemMetadata)

    return {
        name: path,
        fileName: file,
        isScreenshot: file?.indexOf('screenshot') !== -1,
        isWhatsapp: whatsappRegexName.test(file ?? '') || path.indexOf('whatsapp') !== -1,
        isFacebook: facebookRegexName.test(file ?? ''),
        extension: extension,
        fileType: getFileType(extension.toLowerCase()),
        date: date,
        tags: metadataExiftool
    }
}


const filesAreEqual = (metadata: Metadata, otherMetadata: Metadata) => {
    return otherMetadata.tags?.FileSize == metadata.tags?.FileSize && otherMetadata.date == metadata.date
}

const readMetadataAndCopy = async (from: string, file: string, destination: string) => {
    const metadata = await readMetadata(from + '/' + file)

    let startFolder: string = metadata.fileType
    if (metadata.isScreenshot) {
        startFolder = 'screenshot/' + startFolder
    }
    if (metadata.isWhatsapp) {
        startFolder = 'whatsapp/' + startFolder
    }
    if (metadata.isFacebook) {
        startFolder = 'facebook/' + startFolder
    }

    let finalDestination = `${destination}/${startFolder}/${metadata.date.format('YYYY')}/${metadata.date.format('MMMM')}`

    await createDirIfNotExists(finalDestination)

    let finalFileDest = `${finalDestination}/${file}`

    const stat = getStats(finalFileDest)
    if (stat != null) {
        const otherMetadata = await readMetadata(from + '/' + file)
        if (filesAreEqual(metadata, otherMetadata)) {
            return
        }

        const random = Math.random() * 100
        finalFileDest = `${finalDestination}/${random}_other_${file}`
    }

    await moveFile(from + '/' + file, finalFileDest)
}

const readFilesAndDirectories = async (path: string, destination: string, bar: SingleBar) => {
    const filesOrDir = await readFiles(path as string)

    for (const fileOrDir of filesOrDir) {
        if (isDirectory(path + '/' + fileOrDir)) {
            await readFilesAndDirectories(path + '/' + fileOrDir, destination, bar)
            continue
        }

        await readMetadataAndCopy(path, fileOrDir, destination)
        bar.increment(1)
    }
}

const validPath = (path: string | undefined) => !path || path === '?'

export default async (args: CommandArgs) => {
    moment.locale('it')
    let path = args?.path ?? prompt('What is the path: ')

    if (validPath(path)) {
        throw new Error('No path specified')
    }

    const totalElements = (await walk(path)).length
    const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)
    bar.start(totalElements, 0)

    const destination = args?.destination ?? prompt('What is the destination: ')

    await readFilesAndDirectories(path, destination, bar)

    bar.stop()
}

interface CommandArgs extends minimist.ParsedArgs {
    path?: string
    destination?: string
}