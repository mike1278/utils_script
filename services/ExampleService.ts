import useFetchApi from '~/utils/useFetchApi'
import type Pagination from '~/types/pagination'
import { readCsv, writeCsv } from '~/utils/CsvUtils'

export const index = (page: number) => {
    return useFetchApi<Pagination<any>>('/example', {
        method: 'POST',
        body: {
            page: page,
            searchMode: 'SIMPLE',
            size: 50,
            sort: ['aum,desc'],
        },
    })
}

export const readResumedCsv = (): Promise<any[]> => {
    return readCsv('output/example_input.csv')
}
export const writeResumedCsv = (data: any[]) => {
    const date = new Date().getTime()
    return writeCsv(data, 'output/example_output_' + date + '.csv')
}
