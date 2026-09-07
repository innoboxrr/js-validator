import { afterEach, describe, expect, it, vi } from 'vitest'
import JSValidator from '../src/JSValidator.js'

afterEach(() => {
    document.body.innerHTML = ''
})

/**
 * Monta un formulario con el marcado que emiten los componentes de
 * innoboxrr-form-elements: `data-validators` en el control, sin ninguna clase
 * especial.
 */
const form = (html, id = 'f') => {
    document.body.innerHTML = `<form id="${id}">${html}</form>`

    return document.getElementById(id)
}

const input = (name, validators, attrs = '') =>
    `<input name="${name}" data-validators="${validators}" ${attrs} />`

describe('descubrimiento de controles', () => {
    /**
     * Buscaba `.jsValidator`, una clase que no anade nadie en todo el
     * ecosistema: seleccionaba cero controles y no validaba nada. Cada
     * validators="required" de cada formulario generado era decorativo.
     */
    it('encuentra los controles por data-validators', () => {
        form(input('title', 'required'))

        expect(new JSValidator('f').controls).toHaveLength(1)
    })

    it('sigue admitiendo la clase jsValidator escrita a mano', () => {
        form('<input name="a" class="jsValidator" />')

        expect(new JSValidator('f').controls).toHaveLength(1)
    })

    it('encuentra selects y textareas, no solo inputs', () => {
        form(`
            <select name="a" data-validators="required"></select>
            <textarea name="b" data-validators="required"></textarea>
        `)

        expect(new JSValidator('f').controls).toHaveLength(2)
    })

    it('refresh recoge los campos anadidos despues', () => {
        const node = form(input('a', 'required'))
        const validator = new JSValidator('f')

        node.insertAdjacentHTML('beforeend', input('b', 'required'))

        expect(validator.refresh().controls).toHaveLength(2)
    })

    it('sin formulario lanza en vez de fallar mas tarde', () => {
        expect(() => new JSValidator('no-existe')).toThrow(/No se encontró el formulario/)
    })
})

describe('estado inicial', () => {
    /**
     * Empezaba en false, y los formularios generados leen .status en su propio
     * manejador de submit, que corre antes que el del validador: el primer
     * envio siempre se descartaba y habia que pulsar dos veces.
     */
    it('un formulario recien montado es valido', () => {
        form(input('title', 'required'))

        expect(new JSValidator('f').status).toBe(true)
    })
})

describe('validate', () => {
    it('devuelve el resultado, sin depender del orden de los manejadores', () => {
        form(input('title', 'required'))

        expect(new JSValidator('f').validate()).toBe(false)
    })

    it('un campo lleno pasa', () => {
        form(input('title', 'required', 'value="hola"'))

        expect(new JSValidator('f').validate()).toBe(true)
    })

    it('acumula los errores con su control', () => {
        form(input('a', 'required') + input('b', 'required'))

        const validator = new JSValidator('f')

        validator.validate()

        expect(validator.errors).toHaveLength(2)
        expect(validator.errors[0].control.name).toBe('a')
    })

    it('valida varias reglas del mismo campo', () => {
        form(input('correo', 'required email', 'value="no-es-un-email"'))

        const validator = new JSValidator('f')

        expect(validator.validate()).toBe(false)
        expect(validator.errors).toHaveLength(1)
    })

    it('admite las reglas separadas por barra, como en Laravel', () => {
        form(input('correo', 'required|email', 'value="malo"'))

        expect(new JSValidator('f').validate()).toBe(false)
    })

    /**
     * Era `this['_' + name](input)`: un validador que no existiera reventaba
     * con un TypeError a mitad del envio.
     */
    it('una regla desconocida avisa pero no revienta', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

        form(input('a', 'inventada', 'value="x"'))

        expect(new JSValidator('f').validate()).toBe(true)
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('inventada'))

        warn.mockRestore()
    })

    it('un control sin data-validators no se valida', () => {
        form('<input name="a" class="jsValidator" />')

        expect(new JSValidator('f').validate()).toBe(true)
    })
})

describe('mensajes', () => {
    it('escribe el error junto a su control', () => {
        form(input('title', 'required'))

        const validator = new JSValidator('f')

        validator.validate()

        const slot = document.querySelector('.error-msg')

        expect(slot.innerHTML).toContain('Este campo es requerido')
        expect(slot.dataset.for).toBe('title')
    })

    /**
     * Los mensajes se leian con input.nextElementSibling. Con el marcado
     * actual el hermano de un campo de contrasena es el boton del ojo, asi
     * que el mensaje acababa en el sitio equivocado.
     */
    it('el hueco del mensaje no depende de quien sea el hermano', () => {
        form(`<div class="wrap">${input('secret', 'required')}<button type="button">ojo</button></div>`)

        const validator = new JSValidator('f')

        validator.validate()

        const slot = document.querySelector('.error-msg')

        expect(slot.previousElementSibling.name).toBe('secret')
        expect(slot.innerHTML).toContain('requerido')
    })

    it('marca el control como invalido para los lectores de pantalla', () => {
        form(input('title', 'required'))

        new JSValidator('f').validate()

        expect(document.querySelector('[name="title"]').getAttribute('aria-invalid')).toBe('true')
    })

    it('reset limpia mensajes y estado', () => {
        form(input('title', 'required'))

        const validator = new JSValidator('f')

        validator.validate()
        validator.reset()

        expect(validator.status).toBe(true)
        expect(validator.errors).toHaveLength(0)
        expect(document.querySelector('.error-msg').innerHTML).toBe('')
        expect(document.querySelector('[name="title"]').hasAttribute('aria-invalid')).toBe(false)
    })

    it('los mensajes se pueden cambiar', () => {
        form(input('title', 'required'))

        const validator = new JSValidator('f', { messages: { required: 'Obligatorio' } })

        validator.validate()

        expect(document.querySelector('.error-msg').innerHTML).toContain('Obligatorio')
    })
})

describe('errores del servidor', () => {
    it('coloca cada error de Laravel en su campo', () => {
        form(input('title', 'required'))

        const validator = new JSValidator('f')

        validator.appendExternalErrors({ title: ['El título ya existe.'] })

        expect(document.querySelector('.error-msg').innerHTML).toContain('El título ya existe.')
        expect(validator.status).toBe(false)
    })

    /**
     * Buscaba input[name=clave] sin comillas: un nombre con corchetes rompia
     * el selector. Y solo miraba input, no select ni textarea.
     */
    it('funciona con nombres con corchetes', () => {
        form('<input name="fqs[0][question]" data-validators="required" />')

        const validator = new JSValidator('f')

        validator.appendExternalErrors({ 'fqs[0][question]': ['Requerido.'] })

        expect(document.querySelector('.error-msg').innerHTML).toContain('Requerido.')
    })

    it('funciona con un select', () => {
        form('<select name="status" data-validators="required"></select>')

        const validator = new JSValidator('f')

        validator.appendExternalErrors({ status: ['Inválido.'] })

        expect(document.querySelector('.error-msg').innerHTML).toContain('Inválido.')
    })

    /**
     * Un error de un campo que el formulario no muestra se perdia en silencio.
     */
    it('lo que no encuentra campo se muestra al pie del formulario', () => {
        form(input('title', 'required'))

        const validator = new JSValidator('f')

        validator.appendExternalErrors({ oculto: ['Algo pasa.'] })

        expect(document.querySelector('.form-error-msg').innerHTML).toContain('oculto: Algo pasa.')
    })

    it('acepta un mensaje suelto y no solo un array', () => {
        form(input('title', 'required'))

        new JSValidator('f').appendExternalErrors({ title: 'Uno solo.' })

        expect(document.querySelector('.error-msg').innerHTML).toContain('Uno solo.')
    })
})

describe('init', () => {
    it('impide el envio de un formulario invalido', () => {
        const node = form(input('title', 'required'))
        const validator = new JSValidator('f').init()

        const event = new Event('submit', { cancelable: true, bubbles: true })

        node.dispatchEvent(event)

        expect(event.defaultPrevented).toBe(true)
        expect(validator.status).toBe(false)
    })

    it('deja pasar el envio de un formulario valido', () => {
        const node = form(input('title', 'required', 'value="hola"'))

        new JSValidator('f').init()

        const event = new Event('submit', { cancelable: true, bubbles: true })

        node.dispatchEvent(event)

        expect(event.defaultPrevented).toBe(false)
    })

    /**
     * En captura: asi corre antes que el manejador del framework, que es quien
     * decide si envia. Antes el orden dependia de quien se registrara primero.
     */
    it('corre antes que el manejador del framework', () => {
        const node = form(input('title', 'required'))
        const framework = vi.fn()

        node.addEventListener('submit', framework)

        new JSValidator('f').init()

        node.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))

        expect(framework).not.toHaveBeenCalled()
    })

    /**
     * Avisar de "campo requerido" antes de que al usuario le haya dado tiempo
     * a escribir es ruido.
     */
    it('no valida al escribir hasta el primer intento de envio', () => {
        const node = form(input('title', 'required'))
        const validator = new JSValidator('f').init()
        const control = document.querySelector('[name="title"]')

        control.dispatchEvent(new Event('input', { bubbles: true }))

        expect(validator.errors).toHaveLength(0)

        node.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
        control.value = ''
        control.dispatchEvent(new Event('input', { bubbles: true }))

        expect(validator.errors).toHaveLength(1)
    })

    it('revalidar al escribir limpia el error cuando se corrige', () => {
        const node = form(input('title', 'required'))
        const validator = new JSValidator('f').init()
        const control = document.querySelector('[name="title"]')

        node.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))

        expect(validator.status).toBe(false)

        control.value = 'ya'
        control.dispatchEvent(new Event('input', { bubbles: true }))

        expect(validator.status).toBe(true)
        expect(document.querySelector('.error-msg').innerHTML).toBe('')
    })

    /**
     * Un formulario que se monta y desmonta varias veces —un modal, una vista
     * de edicion— acumulaba manejadores.
     */
    it('destroy desengancha todo', () => {
        const node = form(input('title', 'required'))
        const validator = new JSValidator('f').init()

        validator.destroy()

        const event = new Event('submit', { cancelable: true, bubbles: true })

        node.dispatchEvent(event)

        expect(event.defaultPrevented).toBe(false)
    })
})
