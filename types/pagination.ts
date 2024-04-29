export interface Sort {
    empty: boolean
    sorted: boolean
    unsorted: boolean
}

export default interface Pagination<T> {
    content: T[]
    pageable: {
        sort: Sort
        offset: number
        pageNumber: number
        pageSize: number
        unpaged: boolean
        paged: boolean
    }
    last: boolean
    totalElements: number
    totalPages: number
    size: number
    number: number
    first: boolean
    sort: Sort
    numberOfElements: number
    empty: boolean
}
