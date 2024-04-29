import type { FetchError } from 'ofetch'
import lodash from 'lodash'
import { $fetch } from 'ofetch'
import type { FetchOptions } from 'ofetch'

const merge = lodash.merge

export default async <DataT>(url: string, options: FetchOptions = {}) => {
    const token = process.env.TOKEN
    const baseURL = 'https://wmpsvl01.bccsi.bcc.it'

    const otherOptions: FetchOptions = {}

    //^ set the token for the logged user api, if exists
    if (token) {
        otherOptions.headers = {
            Authorization: `Bearer ${token}`,
            ...otherOptions.headers,
        }
    }

    merge(otherOptions, options)
    // @ts-ignore
    return (
        (await $fetch<DataT>(`${url}`, {
            //^ $fetch used to avoid status pending
            ...otherOptions,
            baseURL,
        }).catch((error: FetchError<any>) => {
            console.log(error)
        })) ?? null
    )
}
