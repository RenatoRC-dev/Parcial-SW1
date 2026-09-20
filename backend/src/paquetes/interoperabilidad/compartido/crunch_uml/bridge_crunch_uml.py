"""Puente mínimo entre el backend SW1 y la API local de crunch_uml 0.6.0."""

import hashlib
import json
import sys
from argparse import Namespace
from pathlib import Path


def configurar_crunch(ruta: str):
    repositorio = Path(ruta).resolve()
    if not (repositorio / "crunch_uml" / "__init__.py").is_file():
        raise RuntimeError("CONFIGURACION: No se encontró el paquete local crunch_uml.")
    sys.path.insert(0, str(repositorio))


def multiplicidad(inicio, fin):
    inicio = None if inicio in (None, "", "None") else str(inicio)
    fin = None if fin in (None, "", "None") else str(fin)
    if inicio == "1" and fin == "1":
        return "1"
    if inicio == "0" and fin == "1":
        return "0..1"
    if inicio == "0" and fin in ("*", "-1"):
        return "0..*"
    if inicio == "1" and fin in ("*", "-1"):
        return "1..*"
    return None


def extremos(valor):
    return {
        "1": ("1", "1"),
        "0..1": ("0", "1"),
        "0..*": ("0", "*"),
        "1..*": ("1", "*"),
    }[valor]


def importar(entrada: Path, salida: Path):
    from lxml import etree
    from crunch_uml import const, db
    import crunch_uml.schema as sch
    from crunch_uml.parsers.eaxmiparser import EAXMIParser

    try:
        parser_xml = etree.XMLParser(resolve_entities=False, no_network=True, recover=False)
        raiz = etree.parse(str(entrada), parser_xml).getroot()
    except Exception:
        raise ValueError("ENTRADA: El contenido no es XML/XMI válido.")

    database = db.Database("sqlite:///:memory:", db_create=True)
    schema = sch.Schema(database, "intercambio")
    argumentos = Namespace(inputfile=str(entrada), url=None, skip_xmi_relations=False)
    try:
        EAXMIParser().parse(argumentos, schema)
        database.commit()
    except Exception:
        raise ValueError("ENTRADA: El contenido no tiene una estructura XMI compatible.")

    advertencias = []
    ns_xmi = "{http://schema.omg.org/spec/XMI/2.1}"
    tipos_asociacion = {}
    todos_asociacion = {}
    clases_abstractas = set()
    visibilidad_omitida = False
    for elemento in raiz.iter():
        nombre_local = etree.QName(elemento).localname if isinstance(elemento.tag, str) else ""
        if elemento.get("isAbstract") == "true":
            clase_id = elemento.get(ns_xmi + "id")
            if clase_id:
                clases_abstractas.add(clase_id)
        if elemento.tag == "ownedAttribute" and elemento.get("association") is None and elemento.get("visibility"):
            visibilidad_omitida = True
        if elemento.get("association") and elemento.get("aggregation") in ("shared", "composite"):
            asociacion_id = elemento.get("association")
            if asociacion_id:
                tipo = "composicion" if elemento.get("aggregation") == "composite" else "agregacion"
                if tipos_asociacion.get(asociacion_id) != "composicion":
                    tipos_asociacion[asociacion_id] = tipo
                tipo_extremo = next(
                    (hijo for hijo in elemento if etree.QName(hijo).localname == "type"),
                    None,
                )
                if tipo_extremo is not None and tipo_extremo.get(ns_xmi + "idref"):
                    todos_asociacion[asociacion_id] = tipo_extremo.get(ns_xmi + "idref")
        # EA tambien puede declarar aggregation dentro de la extension del
        # conector. El idref del contenedor identifica la clase del extremo Todo.
        if nombre_local == "type" and elemento.get("aggregation") in ("shared", "composite"):
            extremo = elemento.getparent()
            conector = extremo.getparent() if extremo is not None else None
            asociacion_id = conector.get(ns_xmi + "idref") if conector is not None else None
            todo_id = extremo.get(ns_xmi + "idref") if extremo is not None else None
            if asociacion_id:
                tipo = "composicion" if elemento.get("aggregation") == "composite" else "agregacion"
                if tipos_asociacion.get(asociacion_id) != "composicion":
                    tipos_asociacion[asociacion_id] = tipo
                if todo_id:
                    todos_asociacion[asociacion_id] = todo_id

    if visibilidad_omitida:
        advertencias.append({
            "codigo": "VISIBILIDAD_ATRIBUTO_OMITIDA",
            "mensaje": "La visibilidad de atributos no se conserva porque no forma parte del perfil comprobado.",
        })
    if schema.count_enumeratie() > 0:
        advertencias.append({"codigo": "ENUMERACION_OMITIDA", "mensaje": "Las enumeraciones están fuera del perfil XMI soportado."})
    paquetes = sorted(schema.get_all_packages(), key=lambda item: item.id)
    identificador = paquetes[0].id if paquetes else "modelo-xmi-" + hashlib.sha256(entrada.read_bytes()).hexdigest()[:16]
    nombre = paquetes[0].name if paquetes and paquetes[0].name else "Modelo importado"
    posiciones = {}
    diagramas = sorted(schema.get_all_diagrams(), key=lambda item: item.id)
    if diagramas:
        posiciones = {
            miembro.class_id: {"x": miembro.x, "y": miembro.y}
            for miembro in diagramas[0].diagram_classes
            if miembro.x is not None and miembro.y is not None
        }

    clases = []
    ids_clases = set()
    for indice, clase in enumerate(sorted(schema.get_all_classes(), key=lambda item: item.id)):
        if clase.name == const.ORPHAN_CLASS:
            continue
        ids_clases.add(clase.id)
        posicion = posiciones.get(clase.id, {"x": 100 + (indice % 3) * 350, "y": 100 + (indice // 3) * 250})
        atributos = []
        for atributo in sorted(clase.attributes, key=lambda item: item.id):
            if atributo.id.startswith("EAID_src") or atributo.id.startswith("EAID_dst"):
                continue
            dato = {"id": atributo.id, "nombre": atributo.name or "", "tipo": atributo.primitive or None}
            atributos.append(dato)
        clases.append({
            "id": clase.id,
            "nombre": clase.name or "",
            "atributos": atributos,
            "posicion": posicion,
            "abstracta": clase.id in clases_abstractas,
        })

    atributos_sin_tipo = [
        f'{clase["nombre"]}.{atributo["nombre"]}'
        for clase in clases for atributo in clase["atributos"] if atributo["tipo"] is None
    ]
    if atributos_sin_tipo:
        advertencias.append({
            "codigo": "ATRIBUTOS_SIN_TIPO",
            "mensaje": f"{len(atributos_sin_tipo)} atributos sin tipo definido. Se conservaron como incompletos para su edición.",
        })

    relaciones = []
    for asociacion in sorted(schema.get_all_associations(), key=lambda item: item.id):
        origen = multiplicidad(asociacion.src_mult_start, asociacion.src_mult_end)
        destino = multiplicidad(asociacion.dst_mult_start, asociacion.dst_mult_end)
        if asociacion.src_class_id not in ids_clases or asociacion.dst_class_id not in ids_clases:
            raise ValueError("ENTRADA: Una relación referencia clases inexistentes en el modelo importado.")
        nombre_origen = next(clase["nombre"] for clase in clases if clase["id"] == asociacion.src_class_id)
        nombre_destino = next(clase["nombre"] for clase in clases if clase["id"] == asociacion.dst_class_id)
        if origen is None or destino is None:
            advertencias.append({
                "codigo": "MULTIPLICIDAD_RELACION_INCOMPLETA",
                "mensaje": f"La relación {nombre_origen} → {nombre_destino} tiene una multiplicidad no representable por el perfil canónico y se conservó como incompleta.",
            })
        clase_origen_id = asociacion.src_class_id
        clase_destino_id = asociacion.dst_class_id
        rol_origen = asociacion.src_role
        rol_destino = asociacion.dst_role
        tipo_relacion = tipos_asociacion.get(asociacion.id, "asociacion")
        todo_id = todos_asociacion.get(asociacion.id)
        if tipo_relacion in ("agregacion", "composicion") and todo_id == clase_origen_id:
            clase_origen_id, clase_destino_id = clase_destino_id, clase_origen_id
            origen, destino = destino, origen
            rol_origen, rol_destino = rol_destino, rol_origen
        relacion = {
            "id": asociacion.id,
            "tipo": tipo_relacion,
            "claseOrigenId": clase_origen_id,
            "claseDestinoId": clase_destino_id,
            "multiplicidadOrigen": origen,
            "multiplicidadDestino": destino,
        }
        if rol_origen:
            relacion["rolOrigen"] = rol_origen
        if rol_destino:
            relacion["rolDestino"] = rol_destino
        relaciones.append(relacion)

    for generalizacion in sorted(schema.get_all_generalizations(), key=lambda item: item.id):
        if generalizacion.subclass_id not in ids_clases or generalizacion.superclass_id not in ids_clases:
            raise ValueError("ENTRADA: Una generalización referencia clases inexistentes en el modelo importado.")
        relaciones.append({
            "id": generalizacion.id,
            "tipo": "generalizacion",
            "claseOrigenId": generalizacion.subclass_id,
            "claseDestinoId": generalizacion.superclass_id,
            "multiplicidadOrigen": None,
            "multiplicidadDestino": None,
        })

    resultado = {
        "modelo": {"id": identificador, "nombre": nombre, "version": "4.2.0", "clases": clases, "relaciones": relaciones},
        "advertencias": advertencias,
    }
    salida.write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")


def exportar(entrada: Path, salida: Path):
    from crunch_uml import db
    import crunch_uml.schema as sch
    from crunch_uml.renderers.xmirenderer import XMIRenderer

    modelo = json.loads(entrada.read_text(encoding="utf-8"))
    database = db.Database("sqlite:///:memory:", db_create=True)
    schema = sch.Schema(database, "intercambio")
    paquete = db.Package(id=modelo["id"], name=modelo["nombre"])
    schema.save(paquete)

    for clase in modelo["clases"]:
        schema.save(db.Class(id=clase["id"], name=clase["nombre"], package_id=paquete.id))
        for atributo in clase["atributos"]:
            schema.save(db.Attribute(
                id=atributo["id"], name=atributo["nombre"], primitive=atributo.get("tipo"), clazz_id=clase["id"],
            ))

    for relacion in modelo["relaciones"]:
        origen_inicio, origen_fin = extremos(relacion["multiplicidadOrigen"])
        destino_inicio, destino_fin = extremos(relacion["multiplicidadDestino"])
        schema.save(db.Association(
            id=relacion["id"], name=relacion.get("nombre", ""), src_class_id=relacion["claseOrigenId"],
            dst_class_id=relacion["claseDestinoId"], src_mult_start=origen_inicio,
            src_mult_end=origen_fin, dst_mult_start=destino_inicio, dst_mult_end=destino_fin,
            src_role=relacion.get("rolOrigen"), dst_role=relacion.get("rolDestino"),
        ))

    diagrama_id = "EAID_DIAGRAM_" + hashlib.sha256(modelo["id"].encode("utf-8")).hexdigest()[:24]
    diagrama = db.Diagram(id=diagrama_id, name=modelo["nombre"], package_id=paquete.id)
    for clase in modelo["clases"]:
        posicion = clase.get("posicion") or {"x": 100, "y": 100}
        diagrama.diagram_classes.append(db.DiagramClass(
            diagram_id=diagrama_id, schema_id=schema.schema_id, class_id=clase["id"],
            x=posicion["x"], y=posicion["y"], width=220, height=max(100, 70 + 24 * len(clase["atributos"])),
        ))
    for relacion in modelo["relaciones"]:
        diagrama.diagram_associations.append(db.DiagramAssociation(
            diagram_id=diagrama_id, schema_id=schema.schema_id, association_id=relacion["id"]
        ))
    schema.save(diagrama)
    database.commit()
    XMIRenderer().render(Namespace(outputfile=str(salida)), schema)


def main():
    if len(sys.argv) != 5:
        raise RuntimeError("CONFIGURACION: Uso inválido del puente XMI.")
    _, operacion, crunch, entrada, salida = sys.argv
    configurar_crunch(crunch)
    if operacion == "importar":
        importar(Path(entrada), Path(salida))
    elif operacion == "exportar":
        exportar(Path(entrada), Path(salida))
    else:
        raise RuntimeError("CONFIGURACION: Operación XMI desconocida.")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, RuntimeError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(2)
    except Exception as error:
        print(f"INTERNO: {type(error).__name__}: {error}", file=sys.stderr)
        raise SystemExit(1)
