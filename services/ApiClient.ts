export default class ApiClient {
    protected baseURL: string;
    protected serviceKey: string;

    constructor(baseURL: string = '') {
        if (!baseURL)
            this.baseURL = process.env.API_URL;
        else
            this.baseURL = baseURL

        this.serviceKey = process.env.SERVICE_KEY;
    }

    protected accessMiddleware(options: any): any {
        if (!options.hasOwnProperty('headers'))
            options.headers = {};

        options.headers.Authorization = `Bearer ${this.serviceKey}`;

        return options;
    }

    private buildFormData(data: any): FormData {
        const form = new FormData();

        for (const key in data) {
            if (data[key] === null || data[key] === undefined)
                continue;

            if (Array.isArray(data[key])) {
                data[key].forEach((item: any, index: number) => form.append(`${key}[${index}]`, item));
            } else {
                form.append(key, data[key]);
            }
        }

        return form;
    }

    public get(request: string): Promise<Response> {
        return fetch(`${this.baseURL}${request}`, this.accessMiddleware(
            {
                headers: {
                    Accept: 'application/json'
                }
            }
        ));
    }

    public getFile(request: string): Promise<Blob> {
        return $fetch<Blob>(request, this.accessMiddleware(
            {
                baseURL: this.baseURL
            }
        ));
    }

    public post(request: string, data: any = {}, asMultipart: boolean = false): Promise<Response> {
        const headers: any = {};

        if (asMultipart)
            data = this.buildFormData(data);

        return fetch(`${this.baseURL}${request}`, this.accessMiddleware(
            {
                headers: {
                    Accept        : 'application/json',
                    'Content-Type': 'application/json',
                    ...headers
                },
                method : 'POST',
                body   : JSON.stringify(data)
            }
        ));
    }

    public put<Type>(request: string, data: any = {}, asMultipart: boolean = false): Promise<Type> {
        const headers: any = {};

        if (asMultipart) {
            data = this.buildFormData(data);
            data.append('_method', 'PUT');
        }

        return $fetch<Type>(request, this.accessMiddleware(
            {
                baseURL: this.baseURL,
                headers: {
                    Accept: 'application/json',
                    ...headers
                },
                method : asMultipart ? 'POST' : 'PUT',
                body   : data
            }
        ));
    }

    public patch(request: string, data: any = {}, asMultipart: boolean = false): Promise<Response> {
        const headers: any = {};

        if (asMultipart) {
            data = this.buildFormData(data);
            data.append('_method', 'PATCH');
        }

        return fetch(`${this.baseURL}${request}`, this.accessMiddleware(
            {
                headers: {
                    Accept        : 'application/json',
                    'Content-Type': 'application/json',
                    ...headers
                },
                method : asMultipart ? 'POST' : 'PATCH',
                body   : JSON.stringify(data)
            }
        ));
    }

    public delete(request: string, data: any = {}, asMultipart: boolean = false): Promise<Response> {
        const headers: any = {};

        if (asMultipart) {
            data = this.buildFormData(data);
            data.append('_method', 'DELETE');
        }

        return fetch(`${this.baseURL}${request}`, this.accessMiddleware(
            {
                headers: {
                    Accept: 'application/json',
                    ...headers
                },
                method : asMultipart ? 'POST' : 'DELETE',
                body   : data
            }
        ));
    }

    public getData<Type>(key: string, request: string) {
        return useAsyncData<Type>(key, () => this.get<Type>(request));
    }

    public getLazyFetch<Type>(request: () => string) {
        return useLazyFetch<Type>(request, this.accessMiddleware(
            {
                baseURL: this.baseURL,
                headers: {
                    Accept: 'application/json'
                }
            }
        ));
    }
}