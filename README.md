# innoboxrr-js-validator

Validación de formularios en el navegador, a partir del atributo
`data-validators` que emiten los componentes de
[`innoboxrr-form-elements`](../form-elements) y su gemelo React.

```
npm i innoboxrr-js-validator
```

## Uso

```js
import JSValidator from 'innoboxrr-js-validator'

const validator = new JSValidator('createPostForm').init()

// En tu propio manejador de envío:
if (! validator.validate()) {
    return
}
```

```html
<input name="title" data-validators="required length" data-min_length="3" />
```

Las reglas van separadas por espacios o por barras, como en Laravel:
`required|email`.

## Reglas

| | |
|---|---|
| `required` | No vacío. En `checkbox` y `radio` mira si está marcado. |
| `checked` | La casilla tiene que estar marcada. |
| `length` | Entre `data-min_length` y `data-max_length`. |
| `range` | Entre `data-min` y `data-max`, comparando **números**. |
| `email`, `url`, `host`, `date`, `phone` | Formato. |
| `integer`, `positive_integer`, `decimal` | Número. |
| `alpha`, `alphanumeric`, `alpha_dash`, `alphanumeric_dash` | Caracteres. |
| `password_confirmation` | Igual al campo `password` del formulario. |

Todas salvo `required` y `checked` **ignoran el campo vacío**: de eso se
encarga `required`, y sin esa convención un campo opcional con formato daría
error por estar vacío.

Se pueden añadir reglas propias:

```js
new JSValidator('miForm', {
    rules: {
        rfc: (value, { messages }) => /^[A-Z&Ñ]{3,4}\d{6}[A-Z\d]{3}$/.test(value)
            ? null
            : 'RFC inválido',
    },
})
```

Una regla es una función pura: recibe el valor y el contexto, y devuelve el
mensaje de error o `null`.

## Errores del servidor

```js
try {
    await guardar()
} catch (error) {
    if (error.response?.status === 422) {
        validator.appendExternalErrors(error.response.data.errors)
    }
}
```

Cada error se coloca junto a su campo. Lo que no encuentre campo se muestra al
pie del formulario, en vez de perderse.

## API

| | |
|---|---|
| `validate()` | Valida todo y **devuelve** si es válido. |
| `validateControl(control)` | Valida uno. |
| `status` | El resultado de la última validación. Empieza en `true`. |
| `errors` | `[{ control, message }]`. |
| `reset()` | Limpia mensajes y estado. |
| `refresh()` | Vuelve a buscar controles, para campos añadidos después. |
| `init()` | Engancha la validación al `submit` y al escribir. |
| `destroy()` | La desengancha. |

## Qué cambió en la 2.0

Los dos primeros hacían que **este paquete no validara nada**:

- **Buscaba los controles por la clase `.jsValidator`**, que no añade nadie en
  todo el ecosistema. Los componentes emiten `data-validators`. Seleccionaba
  cero controles, así que cada `validators="required"` de cada formulario
  generado era decorativo.
- **`status` empezaba en `false`.** Los formularios generados lo leen en su
  propio manejador de `submit`, que corre antes que el del validador: el primer
  envío siempre se descartaba y **había que pulsar dos veces**.

Y cuatro más:

- Los mensajes se leían con `input.nextElementSibling`. Con el marcado actual el
  hermano de un campo de contraseña es el botón del ojo, así que acababan en el
  sitio equivocado. Ahora la referencia se guarda, no se deduce del DOM.
- `appendExternalErrors` buscaba `input[name=clave]` sin comillas: un nombre con
  corchetes —`fqs[0][question]`— rompía el selector. Y solo miraba `input`, no
  `select` ni `textarea`.
- Una regla desconocida era `this['_' + nombre](input)`, es decir un `TypeError`
  a mitad del envío. Ahora avisa y sigue.
- `range` comparaba la **cadena** con los números, así que `'9' > 10` daba
  `true`.

Además: `validate()` devuelve el resultado, así que quien llama ya no depende
del orden en que se registraron los manejadores; el `submit` se intercepta en
fase de captura; hay `destroy()` para no acumular manejadores en un formulario
que se monta y desmonta; y los errores marcan `aria-invalid`.

El paquete tampoco declaraba `type: "module"` aunque el código es ESM, ni tenía
un solo test.

## Pruebas

```
npm test
```
