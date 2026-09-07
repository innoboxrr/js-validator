import { defaultLimits, defaultMessages, rules as defaultRules } from './rules.js'

/**
 * Los controles que se validan.
 *
 * `[data-validators]` es lo que emiten los componentes de
 * innoboxrr-form-elements y su gemelo React. La versión anterior buscaba
 * `.jsValidator`, una clase que **no añade nadie** en todo el ecosistema: el
 * validador seleccionaba cero controles y no validaba nada. Cada
 * `validators="required"` de cada formulario generado era decorativo.
 *
 * `.jsValidator` se mantiene por si alguien la escribió a mano.
 */
const SELECTOR = '[data-validators], .jsValidator'

/**
 * Escapa el valor de un atributo para un selector.
 *
 * `CSS.escape` no existe en jsdom ni en navegadores antiguos, y aquí basta con
 * escapar lo que rompe una cadena entre comillas dobles.
 *
 * @param {string} value
 * @returns {string}
 */
const escapeAttribute = (value) => String(value).replace(/(["\\])/g, '\\$1')

export default class JSValidator {
    /**
     * @param {string|HTMLFormElement} form  el id del formulario o el propio nodo
     * @param {{messages?: Record<string, string>, limits?: Record<string, number>, rules?: Record<string, Function>, liveValidation?: boolean}} [options]
     */
    constructor(form, options = {}) {
        this.form = typeof form === 'string' ? document.getElementById(form) : form

        if (! this.form) {
            throw new Error(`[innoboxrr-js-validator] No se encontró el formulario '${form}'.`)
        }

        this.messages = { ...defaultMessages, ...options.messages }
        this.limits = { ...defaultLimits, ...options.limits }
        this.rules = { ...defaultRules, ...options.rules }
        this.liveValidation = options.liveValidation ?? true

        /**
         * Empieza en `true`: nada validado es nada inválido.
         *
         * Empezaba en `false`, y los formularios generados leen `.status` en su
         * propio manejador de submit. Como ese manejador corre antes que el del
         * validador, el primer envío siempre se descartaba: **hacía falta
         * pulsar dos veces**.
         */
        this.status = true

        /** @type {Array<{control: HTMLElement, message: string}>} */
        this.errors = []

        /** @type {WeakMap<HTMLElement, HTMLElement>} */
        this.slots = new WeakMap()

        /** @type {Array<() => void>} */
        this.listeners = []

        this.refresh()
    }

    /**
     * Vuelve a buscar los controles. Hace falta cuando el formulario añade
     * campos después de montarse, como los grupos dinámicos.
     */
    refresh() {
        this.controls = Array.from(this.form.querySelectorAll(SELECTOR))
        this.controls.forEach((control) => this.slotFor(control))

        return this
    }

    /**
     * El nodo donde van los mensajes de un control.
     *
     * La versión anterior lo colgaba de `input.parentNode` y luego lo leía con
     * `input.nextElementSibling`. Con el marcado actual eso ya no coincide —el
     * hermano de un campo de contraseña es el botón del ojo—, así que los
     * mensajes se escribían en el sitio equivocado. Aquí la referencia se
     * guarda, y no se deduce del DOM.
     *
     * @param {HTMLElement} control
     * @returns {HTMLElement}
     */
    slotFor(control) {
        if (this.slots.has(control)) {
            return this.slots.get(control)
        }

        const slot = document.createElement('span')

        slot.className = 'error-msg'
        slot.setAttribute('role', 'alert')
        slot.dataset.for = control.name ?? ''

        control.insertAdjacentElement('afterend', slot)
        this.slots.set(control, slot)

        return slot
    }

    /**
     * Valida todo el formulario y devuelve si es válido.
     *
     * Devolver el resultado es lo que permite a quien llama dejar de depender
     * del orden en que se registraron los manejadores de submit.
     *
     * @returns {boolean}
     */
    validate() {
        this.reset()

        this.controls.forEach((control) => this.validateControl(control, false))

        return this.status
    }

    /**
     * @param {HTMLElement} control
     * @param {boolean} [clear]  limpiar antes solo los errores de este control
     * @returns {boolean}
     */
    validateControl(control, clear = true) {
        if (clear) {
            this.clearControl(control)
        }

        const declared = control.dataset.validators

        if (! declared) {
            return true
        }

        const context = { control, form: this.form, messages: this.messages, defaults: this.limits }

        let valid = true

        for (const name of declared.split(/[\s|]+/).filter(Boolean)) {
            const rule = this.rules[name]

            if (! rule) {
                // Antes esto era `this['_' + name](input)`: un validador que no
                // existiera reventaba con un TypeError a mitad del envío.
                console.warn(`[innoboxrr-js-validator] Regla desconocida: '${name}'.`)

                continue
            }

            const message = rule(control.value, context)

            if (message) {
                this.addError(control, message)
                valid = false
            }
        }

        return valid
    }

    /**
     * @param {HTMLElement} control
     * @param {string} message
     */
    addError(control, message) {
        this.status = false
        this.errors.push({ control, message })

        const slot = this.slotFor(control)

        slot.innerHTML += `${message}<br />`
        control.setAttribute('aria-invalid', 'true')
    }

    /**
     * Los errores que devuelve Laravel en un 422.
     *
     * La versión anterior buscaba `input[name=clave]` sin comillas, así que un
     * nombre con corchetes —`fqs[0][question]`— reventaba el selector; y solo
     * miraba `input`, no `select` ni `textarea`. Lo que no encuentre un control
     * se muestra ahora al pie del formulario en vez de perderse.
     *
     * @param {Record<string, string[]>} errors
     */
    appendExternalErrors(errors = {}) {
        Object.entries(errors).forEach(([field, messages]) => {
            const control = this.form.querySelector(
                `[name="${escapeAttribute(field)}"], [name="${escapeAttribute(`${field}[]`)}"]`
            )

            const list = Array.isArray(messages) ? messages : [messages]

            if (control) {
                list.forEach((message) => this.addError(control, message))

                return
            }

            list.forEach((message) => this.addFormError(`${field}: ${message}`))
        })

        return this
    }

    /**
     * Un error que no pertenece a ningún control.
     *
     * @param {string} message
     */
    addFormError(message) {
        this.status = false
        this.errors.push({ control: null, message })

        this.formSlot().innerHTML += `${message}<br />`
    }

    formSlot() {
        if (! this._formSlot || ! this._formSlot.isConnected) {
            this._formSlot = document.createElement('div')
            this._formSlot.className = 'error-msg form-error-msg'
            this._formSlot.setAttribute('role', 'alert')

            this.form.appendChild(this._formSlot)
        }

        return this._formSlot
    }

    /**
     * @param {HTMLElement} control
     */
    clearControl(control) {
        this.errors = this.errors.filter((error) => error.control !== control)
        this.status = this.errors.length === 0

        this.slotFor(control).innerHTML = ''
        control.removeAttribute('aria-invalid')
    }

    reset() {
        this.status = true
        this.errors = []

        this.form.querySelectorAll('.error-msg').forEach((slot) => {
            slot.innerHTML = ''
        })

        this.controls.forEach((control) => control.removeAttribute('aria-invalid'))

        return this
    }

    /**
     * Engancha la validación al formulario.
     *
     * Con `liveValidation`, cada control se revalida al escribir, pero solo
     * después del primer intento de envío: avisar de "campo requerido" antes de
     * que al usuario le haya dado tiempo a escribir es ruido.
     */
    init() {
        const onSubmit = (event) => {
            this.submitted = true

            if (! this.validate()) {
                event.preventDefault()
                event.stopImmediatePropagation()
            }
        }

        // En captura: así corre antes que el manejador del framework, que es
        // quien decide si envía. Sin esto el orden dependía de quién se
        // registrara primero.
        this.form.addEventListener('submit', onSubmit, true)
        this.listeners.push(() => this.form.removeEventListener('submit', onSubmit, true))

        if (this.liveValidation) {
            this.controls.forEach((control) => {
                const onInput = () => {
                    if (this.submitted) {
                        this.validateControl(control)
                    }
                }

                control.addEventListener('input', onInput)
                control.addEventListener('change', onInput)

                this.listeners.push(() => {
                    control.removeEventListener('input', onInput)
                    control.removeEventListener('change', onInput)
                })
            })
        }

        return this
    }

    /**
     * Desengancha todo. Sin esto, un formulario que se monta y desmonta varias
     * veces —un modal, una vista de edición— acumulaba manejadores.
     */
    destroy() {
        this.listeners.forEach((remove) => remove())
        this.listeners = []

        return this
    }
}
