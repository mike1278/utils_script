import moment from "moment"
import type {Tags} from "exiftool-vendored/dist/Tags";

export type FileType = 'image' | 'video' | 'document' | 'other'

export default interface Metadata {
    name: string
    fileName: string
    extension: string
    isScreenshot: boolean
    isWhatsapp: boolean
    isFacebook: boolean
    fileType: FileType
    date: moment.Moment
    tags: Tags | null
}