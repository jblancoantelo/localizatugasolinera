# Documentación legal

Esta carpeta reúne todo lo necesario para que el proyecto sea **software libre**
(AGPLv3), pueda **recibir contribuciones externas** y siga siendo **vendible**
en el futuro.

| Documento | Para qué sirve |
|-----------|----------------|
| [`../../LICENSE`](../../LICENSE) | Texto íntegro e inalterado de la GNU AGPLv3 (la licencia del proyecto) |
| [`../../NOTICE`](../../NOTICE) | Titular del copyright, cómo obtener el código fuente y licencias de terceros |
| [`CLA.md`](./CLA.md) | Acuerdo de Licencia de Contribuyente: lo que firma quien manda código |
| [`CLA-firmas.json`](./CLA-firmas.json) | Registro de quién ha aceptado el CLA |
| [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md) | Guía práctica para contribuir (incluye el proceso de firma) |

---

## 1. Lo que la AGPLv3 permite (y lo que no)

La AGPLv3 es una licencia **libre** y **copyleft fuerte**, con una cláusula
extra (la 13) pensada para software que se usa a través de una red.

**Permite:**

- **Vender** el software, el servicio o el negocio entero. La AGPL no prohíbe
  cobrar; de hecho la FSF anima a ello.
- Cobrar por soporte, instalación, hosting, personalizaciones o SLA.
- Modificar el código y publicar tu propia versión.
- Usar el código en tu empresa sin publicar nada, mientras no lo distribuyas ni
  lo ofrezcas a terceros por red.

**Obliga a:**

- Quien **distribuya** el software o lo **ofrezca por red** debe entregar el
  código fuente completo a los usuarios, bajo AGPLv3, incluidas sus
  modificaciones.
- Mantener los avisos de copyright y de licencia.
- No añadir restricciones adicionales sobre el código AGPL.

**No permite (a ti ni a nadie):**

- Cerrar el código de una versión que ya has publicado bajo AGPL y seguir
  distribuyéndola como propietaria. Esa versión concreta ya es libre para
  siempre.

## 2. Por qué hace falta el CLA si el proyecto es AGPL

Sin CLA, cada persona que aporta código conserva su copyright y su aportación
solo se puede usar bajo AGPLv3. Eso **bloquea** tres cosas:

1. Vender una versión propietaria (doble licencia) del producto.
2. Vender el proyecto a un tercero que quiera explotarlo en cerrado.
3. Cambiar de licencia en el futuro.

El CLA del proyecto no quita derechos a nadie: la contribución sigue siendo
pública bajo AGPLv3. Lo que añade es una **licencia no exclusiva, perpetua e
irrevocable a tu favor**, que además es **transferible** al comprador. Es el
modelo de doble licencia que usan MySQL, Qt, Nextcloud, Grafana, GitLab o
Element.

> Se eligió **licencia amplia** y no **cesión de copyright** a propósito: en
> España la cesión en exclusiva tiene límites legales (art. 46 TRLPI) y muchos
> contribuyentes —o sus empresas— se niegan a ceder la titularidad. Una licencia
> no exclusiva con derecho de relicenciamiento consigue el mismo resultado
> práctico para vender, sin asustar a nadie.

## 3. Escenarios de venta

| Escenario | ¿Se puede? | Qué lo permite |
|-----------|-----------|----------------|
| Vender el acceso al servicio (SaaS) o una app empaquetada | ✅ Sí | AGPLv3 no limita el precio |
| Vender el repositorio + dominio + marca a otro | ✅ Sí | Eres el titular; el CLA es transferible (cláusula 3.3) |
| Lanzar una versión «Pro» de código cerrado | ✅ Sí | CLA, cláusula 3.2 (relicenciamiento) |
| Vender una licencia propietaria a un cliente que quiere el código cerrado | ✅ Sí | CLA, cláusula 3.2 |
| Impedir que alguien redistribuya la versión AGPL | ❌ No | Copyleft: esa versión ya es libre |
| Revocar la AGPL de versiones ya publicadas | ❌ No | Irrevocabilidad de la licencia |

## 4. Requisito de la cláusula 13 (importante para una PWA)

Al ser una aplicación que se usa **por red**, la AGPL exige que los usuarios
puedan **descargar el código fuente** de la versión que están usando. Basta con
un enlace visible a este repositorio.

- [x] Hecho: enlace «Código fuente (AGPLv3)» en
      **Config → Actualización de la app**, apuntando a
      `https://github.com/jblancoantelo/localizatugasolinera`.
      Para cumplir la cláusula 13, ese repositorio debe tener **la misma
      versión** que se está sirviendo (por eso `APP_VERSION` se incrementa en
      cada release).

## 5. Marca y nombre

La licencia **no concede derechos de marca**. Cualquiera puede hacer un fork
legal del código, pero no puede usar el nombre «Localiza tu Gasolinera», el
logotipo ni los iconos para identificar su versión.

- [ ] **Registrar la marca** en la OEPM: guía completa, búsqueda de
      anterioridades, listas de productos/servicios listas para pegar y tasas
      en [`marca.md`](./marca.md).
      Resumen: marca **denominativa** «Localiza tu Gasolinera», clases **9 y
      42**, **210,72 €** por vía electrónica.

## 6. Checklist antes de vender

1. `LICENSE` y `NOTICE` presentes en la raíz del repositorio. ✅
2. Todas las contribuciones externas tienen firma en `CLA-firmas.json`. ✅
   (comprobar con `node scripts/check-cla.mjs --list`)
3. El repositorio público está sincronizado con la versión desplegada
   (cláusula 13).
4. No hay código de terceros con licencia incompatible: revisar `NOTICE` y el
   resultado de `npm ls`.
5. Los datos del Ministerio se usan según sus condiciones de reutilización
   (la licencia del código no cubre esos datos).
6. En el contrato de venta, incluye: cesión del copyright que te pertenece,
   **cesión de los derechos del CLA** (cláusula 3.3) y cesión de marca/dominio.

## 7. Cambiar de licencia más adelante

Como titular del copyright de todo el código y beneficiario de las licencias
del CLA, puedes publicar versiones futuras bajo otra licencia (por ejemplo
AGPLv3 + licencia comercial, o pasar a MIT). Lo que **no** puedes es retirar la
AGPL de las versiones ya publicadas: quien las recibió conserva sus derechos.

## 8. Sobre los datos del Ministerio

Los precios proceden de la API pública del Geoportal de Hidrocarburos. Esos
datos **no son tuyos** y se rigen por sus propias condiciones de reutilización.
La AGPL del código no concede ningún derecho sobre ellos ni sobre la base de
datos.

---

*Última revisión: 29 de octubre de 2026.*
