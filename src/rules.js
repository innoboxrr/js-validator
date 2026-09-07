/**
 * Las reglas de validación, cada una una función pura.
 *
 * Reciben el valor y el contexto —el control, el formulario y los mensajes— y
 * devuelven un mensaje de error o `null`. Antes eran métodos del prototipo que
 * llamaban a `setError` por su cuenta, así que no se podían probar sin montar
 * un formulario entero.
 */

/**
 * @typedef {object} RuleContext
 * @property {HTMLElement} control
 * @property {HTMLFormElement} form
 * @property {Record<string, string>} messages
 * @property {Record<string, number>} defaults
 */

/**
 * @typedef {(value: string, context: RuleContext) => (string|null)} Rule
 */

const EMAIL = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/i
const URL_PATTERN = /^(https?|s?ftp):\/\/[^\s/$.?#].[^\s]*$/i
const HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d+)?$/i

/**
 * Todas las reglas salvo `required` y `checked` ignoran el campo vacío: de eso
 * se encarga `required`, y sin esta convención un campo opcional con formato
 * daría error por estar vacío.
 */
const whenFilled = (check) => (value, context) => (
    String(value ?? '').trim() === '' ? null : check(value, context)
)

const numberFrom = (control, key, fallback) => (
    control.dataset[key] !== undefined ? Number(control.dataset[key]) : fallback
)

/** @type {Record<string, Rule>} */
export const rules = {
    required: (value, { control, messages }) => {
        // Una casilla o un radio se validan por su estado, no por su valor:
        // un checkbox sin marcar tiene value="on".
        if (control.type === 'checkbox' || control.type === 'radio') {
            return control.checked ? null : messages.required
        }

        return String(value ?? '').trim() === '' ? messages.required : null
    },

    checked: (value, { control, messages }) => (control.checked ? null : messages.checked),

    length: (value, { control, messages, defaults }) => {
        const length = String(value ?? '').length
        const min = numberFrom(control, 'min_length', defaults.minLength)
        const max = numberFrom(control, 'max_length', defaults.maxLength)

        if (length < min) {
            return messages.minLength.replace('__minLength__', String(min))
        }

        if (length > max) {
            return messages.maxLength.replace('__maxLength__', String(max))
        }

        return null
    },

    range: (value, { control, messages, defaults }) => {
        const min = numberFrom(control, 'min', defaults.min)
        const max = numberFrom(control, 'max', defaults.max)
        const number = Number(value)

        // La versión anterior comparaba la cadena con los números, así que
        // '9' > 10 daba true y '10' < 2 también.
        if (! Number.isFinite(number) || number < min || number > max) {
            return messages.range.replace('__min__', String(min)).replace('__max__', String(max))
        }

        return null
    },

    email: whenFilled((value, { messages }) => (EMAIL.test(value) ? null : messages.email)),

    integer: whenFilled((value, { messages }) => (/^-?\d+$/.test(value) ? null : messages.integer)),

    positive_integer: whenFilled((value, { messages }) => (
        /^[1-9]\d*$/.test(value) ? null : messages.positive_integer
    )),

    decimal: whenFilled((value, { messages }) => (
        /^-?\d+(\.\d+)?$/.test(value) ? null : messages.decimal
    )),

    alphanumeric: whenFilled((value, { messages }) => (
        /^[a-z0-9]+$/i.test(value) ? null : messages.alphanumeric
    )),

    alpha: whenFilled((value, { messages }) => (/^[a-z]+$/i.test(value) ? null : messages.alpha)),

    alpha_dash: whenFilled((value, { messages }) => (
        /^[a-z\-_]+$/i.test(value) ? null : messages.alpha_dash
    )),

    alphanumeric_dash: whenFilled((value, { messages }) => (
        /^[a-z0-9\-_]+$/i.test(value) ? null : messages.alphanumeric_dash
    )),

    url: whenFilled((value, { messages }) => (URL_PATTERN.test(value) ? null : messages.url)),

    host: whenFilled((value, { messages }) => (HOST.test(value) ? null : messages.host)),

    date: whenFilled((value, { messages }) => (
        /^\d{1,2}[./-]\d{1,2}[./-]\d{4}$|^\d{4}[./-]\d{1,2}[./-]\d{1,2}$/.test(value)
            ? null
            : messages.date
    )),

    phone: whenFilled((value, { messages }) => (
        /^[+\d][\d\-.\s()]*$/.test(value) ? null : messages.phone
    )),

    password_confirmation: (value, { form, messages }) => {
        const password = form.querySelector('[name="password"]')

        if (! password) {
            return messages.password_missing
        }

        return password.value === value ? null : messages.password_mismatch
    },
}

/** @type {Record<string, string>} */
export const defaultMessages = {
    required: 'Este campo es requerido.',
    checked: 'Debes marcar esta casilla para continuar.',
    minLength: 'Longitud no válida. Mínimo __minLength__ caracteres.',
    maxLength: 'Longitud no válida. Máximo __maxLength__ caracteres.',
    range: 'El valor debe estar entre __min__ y __max__.',
    email: 'El campo de email no es válido.',
    integer: 'Por favor coloca un número entero.',
    positive_integer: 'El número debe ser un entero positivo.',
    decimal: 'El valor debe ser un número decimal.',
    alphanumeric: 'Solo se permiten letras y números sin espacios.',
    alpha: 'Solo se permiten letras sin espacios.',
    alpha_dash: 'Solo se permiten letras, guiones y guiones bajos.',
    alphanumeric_dash: 'Solo se permiten letras, números, guiones y guiones bajos.',
    url: 'Escribe una URL válida. Indica el protocolo http:// o https://',
    host: 'Escribe un host válido.',
    date: 'El campo debe ser una fecha.',
    phone: 'El valor debe ser un número de teléfono válido.',
    password_missing: 'No se ha encontrado un campo de contraseña para validar.',
    password_mismatch: 'Los campos de contraseña no coinciden.',
}

/** @type {Record<string, number>} */
export const defaultLimits = {
    minLength: 3,
    maxLength: 255,
    min: 0,
    max: 100,
}
