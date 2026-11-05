const API_URL = 'https://script.google.com/macros/s/AKfycby_FbRuRypDU8nfaPwoXMshpLGDhmqWrz9P88scCfU8tekKe6RHE4hirbkVX5s-5z4g/exec';
let datosApp = {};
let usuarioValidado = null; 
let equipoValidado = null;  
let rolValidado = null; 
let modoEdicionId = null;
let origenNavegacion = 'list-section';

// --- 1. NAVEGACIÓN Y CARGA INICIAL ---
function navegarA(idSeccion) {
    document.querySelectorAll('.app-section').forEach(el => el.style.display = 'none');
    document.getElementById(idSeccion).style.display = 'block';
    if(idSeccion !== 'login-section' && idSeccion !== 'loading') {
        document.getElementById('user-header').style.display = 'block';
    }
}

document.addEventListener("DOMContentLoaded", function() {
    navegarA('loading');
    cargarDatosDesdeAPI(true);
});

// Carga robusta (sin bloqueos)
function cargarDatosDesdeAPI(esCargaInicial = false, tipo = "todo") {
    const url = API_URL; 
    return fetch(url + "?t=" + new Date().getTime()) 
        .then(response => response.json())
        .then(data => {
            if(data.clientes) datosApp.clientes = data.clientes;
            if(data.tipologias) datosApp.tipologias = data.tipologias;
            if(data.estados) datosApp.estados = data.estados;
            if(data.equipos) datosApp.equipos = data.equipos;
            if(data.usuarios) datosApp.usuarios = data.usuarios;
            if(data.tareas) datosApp.tareas = data.tareas;
            if(data.origenes) datosApp.origenes = data.origenes;
            if(data.solicitantes) datosApp.solicitantes = data.solicitantes;
            if(data.notas) datosApp.notas = data.notas;
            if(data.ubicaciones) datosApp.ubicaciones = data.ubicaciones;

            if(esCargaInicial) {
                try {
                    rellenarDesplegables();
                    configurarFechasPorDefecto();
                } catch(e) {
                    console.error("Aviso en el renderizado inicial de UI", e);
                }
                navegarA('login-section');
            }
        })
        .catch(error => {
            console.error("Error crítico de red:", error);
            if(esCargaInicial) navegarA('login-section');
        });
}

function rellenarDesplegables() {
    const cargarOpciones = (selectId, lista) => {
        const select = document.getElementById(selectId);
        if(!select) return; 
        select.innerHTML = '<option value="">Todos...</option>'; 
        if(selectId === 'lugar' || selectId === 'filtro_lugar') select.innerHTML = '<option value="">Selecciona o escribe...</option>';
        (lista || []).forEach(item => {
            let opcion = document.createElement("option");
            opcion.value = item.id; 
            opcion.text = item.nombre;
            select.appendChild(opcion);
        });
    };

    cargarOpciones("lugar", datosApp.clientes);
    cargarOpciones("tipo", datosApp.tipologias);
    cargarOpciones("estado", datosApp.estados);
    cargarOpciones("filtro_lugar", datosApp.clientes);
    cargarOpciones("filtro_estado", datosApp.estados);
    cargarOpciones("filtro_tipo", datosApp.tipologias);

    // Datalists de Administración
    const poblarDatalist = (idDatalist, lista) => {
        const dl = document.getElementById(idDatalist);
        if (!dl) return;
        dl.innerHTML = "";
        (lista || []).forEach(item => {
            let opt = document.createElement("option");
            opt.value = item.nombre || item.id;
            dl.appendChild(opt);
        });
    };
    poblarDatalist("listaOrigenesForm", datosApp.origenes || datosApp.ubicaciones);
    poblarDatalist("listaSolicitantesForm", datosApp.solicitantes);
    poblarDatalist("listaUsuariosAdminForm", datosApp.usuarios);

    // Selector de Equipo de Trabajo Admin
    const selectEq = document.getElementById("meta_equipo");
    if(selectEq) {
        selectEq.innerHTML = '<option value="">Selecciona equipo...</option>';
        (datosApp.equipos || []).forEach(eq => {
            let opt = document.createElement("option");
            opt.value = eq.id || eq.nombre;
            opt.text = eq.nombre;
            selectEq.appendChild(opt);
        });
    }

    if (rolValidado && rolValidado.toLowerCase() === "admin") {
        document.getElementById("zonaFiltrosAdmin").classList.remove("opacity-75");
        document.getElementById("filtro_usuario").disabled = false;
        document.getElementById("filtro_equipo").disabled = false;
        cargarOpciones("filtro_usuario", datosApp.usuarios);
        cargarOpciones("filtro_equipo", datosApp.equipos);
        document.getElementById("filtro_usuario").addEventListener("change", aplicarFiltrosPrincipales);
        document.getElementById("filtro_equipo").addEventListener("change", aplicarFiltrosPrincipales);
    }

    if (document.getElementById("lugar") && document.getElementById("lugar").tomselect) {
        document.getElementById("lugar").tomselect.destroy();
    }
    if (document.getElementById("lugar")) {
        new TomSelect("#lugar", { create: false, sortField: { field: "text", direction: "asc" } });
    }

    if (document.getElementById("filtro_lugar") && document.getElementById("filtro_lugar").tomselect) {
        document.getElementById("filtro_lugar").tomselect.destroy();
    }
    if (document.getElementById("filtro_lugar")) {
        new TomSelect("#filtro_lugar", { create: false, sortField: { field: "text", direction: "asc" } });
    }

    // Selector de Técnico Admin
    const datalistTecnicos = document.getElementById("listaTecnicosAdmin");
    if (rolValidado === 'admin' && datalistTecnicos) {
        datalistTecnicos.innerHTML = '';
        (datosApp.usuarios || []).forEach(u => {
            let opt = document.createElement("option");
            opt.value = `${u.nombre} - ${u.id}`;
            datalistTecnicos.appendChild(opt);
        });
    }
}

function actualizarVisibilidadAdmin() {
    const esAdmin = (rolValidado === 'admin');
    
    // Control de la Nota
    const inputNota = document.getElementById("meta_nota");
    if (inputNota) {
        inputNota.disabled = !esAdmin;
        if(esAdmin) inputNota.classList.remove("bg-light");
        else inputNota.classList.add("bg-light");
    }

    // Control de la Sección Admin
    const secAdmin = document.getElementById("seccion_admin_tarea");
    if (secAdmin) {
        if(esAdmin) secAdmin.classList.remove("d-none");
        else secAdmin.classList.add("d-none");
    }
}

// MODO FANTASMA: Carga de compañeros dinámica basada en el equipo destino
function cargarCompanerosEquipo(equipoForzado = null, stringMarcados = "") {
    const contenedor = document.getElementById("contenedorCompaneros");
    if (!contenedor) return;
    contenedor.innerHTML = "";
    
    let equipoObjetivo = equipoForzado || equipoValidado;
    let arrMarcados = stringMarcados ? stringMarcados.split(';').map(c => c.trim().toLowerCase()).filter(Boolean) : [];

    let eqObjNorm = (equipoObjetivo || "").toString().trim().toLowerCase();

    // Filtramos los usuarios por el equipo objetivo usando el campo 'extra'
    let usuariosDelEquipo = (datosApp.usuarios || []).filter(u => {
        let uEq = (u.extra || u.equipo || "").toString().trim().toLowerCase();
        return uEq === eqObjNorm;
    });

    // Sumar usuarios de otros equipos si están marcados en la BD (Columna N)
    let idsExistentes = new Set(usuariosDelEquipo.map(u => (u.id || "").trim().toLowerCase()));
    (datosApp.usuarios || []).forEach(u => {
        let uEmail = (u.id || "").trim().toLowerCase();
        if (arrMarcados.includes(uEmail) && !idsExistentes.has(uEmail)) {
            usuariosDelEquipo.push(u);
            idsExistentes.add(uEmail);
        }
    });

    if (usuariosDelEquipo.length === 0) {
        contenedor.innerHTML = "<span class='text-muted small'>No hay otros compañeros en este equipo.</span>";
        return;
    }

    usuariosDelEquipo.forEach((comp) => {
        // En el modo estándar, el propio usuario excluye verse a sí mismo. 
        // Si el admin está emulando, mostramos a todos.
        if(rolValidado !== 'admin' && comp.id === usuarioValidado) return;

        const idCheck = "chk_estandar_" + comp.id.replace(/[@.]/g, "_");
        let emailUser = (comp.id || "").trim().toLowerCase();
        let estaMarcado = arrMarcados.includes(emailUser);

        contenedor.innerHTML += `
            <div class="form-check form-check-inline border rounded px-2 py-1 bg-white shadow-sm mb-1 ms-0 me-2">
                <input class="form-check-input check-companero-estandar ms-0 me-2" type="checkbox" id="${idCheck}" value="${comp.id}" ${estaMarcado ? 'checked' : ''}>
                <label class="form-check-label small" for="${idCheck}">${comp.nombre}</label>
            </div>
        `;
    });
}

function obtenerCompanerosSeleccionados() {
    const checks = document.querySelectorAll("#contenedorCompaneros input.check-companero-estandar:checked");
    return Array.from(checks).map(chk => chk.value).join(';');
}

function configurarFechasPorDefecto() {
    const hoy = new Date().toISOString().split('T')[0];
    if(document.getElementById("fecha_inicio")) document.getElementById("fecha_inicio").value = hoy;
    if(document.getElementById("fecha_fin")) document.getElementById("fecha_fin").value = hoy;
}

// EVENTOS DE CAMBIO PARA EL MODO FANTASMA
if (document.getElementById("meta_equipo")) {
    document.getElementById("meta_equipo").addEventListener("change", function() {
        if (rolValidado === 'admin') {
            cargarCompanerosEquipo(this.value, obtenerCompanerosSeleccionados());
        }
    });
}

if (document.getElementById("admin_tecnico_estandar")) {
    document.getElementById("admin_tecnico_estandar").addEventListener("change", function() {
        if (rolValidado === 'admin' && this.value) {
            let emailTecnico = this.value.includes(" - ") ? this.value.split(" - ")[1].trim() : this.value.trim();
            let tecnicoObj = (datosApp.usuarios || []).find(u => u.id === emailTecnico);
            if (tecnicoObj) {
                let eq = tecnicoObj.extra || tecnicoObj.equipo;
                document.getElementById("meta_equipo").value = eq;
                cargarCompanerosEquipo(eq, obtenerCompanerosSeleccionados());
            }
        }
    });
}

// --- 2. LOGIN ---
document.getElementById("btnLogin").addEventListener("click", function() {
    const emailIngresado = document.getElementById("emailInput").value.trim().toLowerCase();
    const usuarioEncontrado = (datosApp.usuarios || []).find(u => u.id.toLowerCase() === emailIngresado);

    if (usuarioEncontrado) {
        usuarioValidado = usuarioEncontrado.id;
        equipoValidado = usuarioEncontrado.extra || usuarioEncontrado.equipo;
        rolValidado = usuarioEncontrado.rol || "tecnico"; 

        document.getElementById("headerNombre").innerText = usuarioEncontrado.nombre;
        const equipoObj = (datosApp.equipos || []).find(e => e.id === equipoValidado || e.nombre === equipoValidado);
        document.getElementById("headerEquipo").innerText = equipoObj ? equipoObj.nombre : equipoValidado;
        document.getElementById("headerRol").innerText = rolValidado;
        
        actualizarVisibilidadAdmin();
        cargarCompanerosEquipo(equipoValidado, ""); 
        rellenarDesplegables();

        const btnMenuAdmin = document.getElementById("colMenuAdmin");
        if (btnMenuAdmin) {
            if (rolValidado.trim().toLowerCase() === "admin") {
                btnMenuAdmin.classList.remove("d-none");
            } else {
                btnMenuAdmin.classList.add("d-none");
            }
        }
        navegarA('menu-section');
    } else {
        document.getElementById("loginError").style.display = "block";
    }
});

// --- 3. LISTADO Y EDICIÓN ---
function normalizarFecha(fechaStr) {
    if (!fechaStr) return "";
    if (typeof fechaStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaStr.trim())) return fechaStr.trim();
    let d = new Date(fechaStr);
    if (!isNaN(d)) {
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();
        let year = d.getFullYear();
        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;
        return [year, month, day].join('-');
    }
    return fechaStr;
}

function convertirAFechaInput(fechaStr) { return normalizarFecha(fechaStr); }
function formatoFechaCorta(fechaStr) {
    let fLimpia = normalizarFecha(fechaStr);
    if (!fLimpia) return "Sin fecha";
    let partes = fLimpia.split('-');
    if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
    return fLimpia;
}

function obtenerMisTareasBase() {
    if (rolValidado === "admin") return datosApp.tareas || [];
    return (datosApp.tareas || []).filter(t => 
        t.usuario === usuarioValidado || (t.companeros && t.companeros.includes(usuarioValidado))
    );
}

function aplicarFiltrosPrincipales() {
    const texto = document.getElementById("buscadorPartes").value.toLowerCase();
    const filtroMes = document.getElementById("filtroMes").value;
    
    let tareas = obtenerMisTareasBase();
    const mesActual = new Date().getMonth();
    const anoActual = new Date().getFullYear();

    tareas = tareas.filter(t => {
        let matchTexto = true;
        if (texto !== "") {
            const nomLugar = (datosApp.clientes.find(c => c.id === t.lugar)?.nombre || "").toLowerCase();
            const desc = t.descripcion_corta ? t.descripcion_corta.toLowerCase() : "";
            matchTexto = nomLugar.includes(texto) || desc.includes(texto);
        }
        let matchMes = true;
        if (filtroMes === "actual") {
            const fechaT = new Date(convertirAFechaInput(t.fecha_inicio));
            matchMes = (fechaT.getMonth() === mesActual && fechaT.getFullYear() === anoActual);
        }
        return matchTexto && matchMes;
    });
    renderizarTareas(tareas);
}

function aplicarFiltrosLaterales() {
    const idLugar = document.getElementById("filtro_lugar").value;
    const idEstado = document.getElementById("filtro_estado").value;
    const idTipo = document.getElementById("filtro_tipo").value;
    const fInicio = document.getElementById("filtro_fecha_inicio").value;
    const fFin = document.getElementById("filtro_fecha_fin").value;
    const idUsuario = document.getElementById("filtro_usuario") ? document.getElementById("filtro_usuario").value : "";
    const idEquipo = document.getElementById("filtro_equipo") ? document.getElementById("filtro_equipo").value : "";

    let tareas = obtenerMisTareasBase();
    tareas = tareas.filter(t => {
        if (idLugar && t.lugar !== idLugar) return false;
        if (idEstado && t.estado !== idEstado) return false;
        if (idTipo && t.tipo !== idTipo) return false;
        
        if (rolValidado === "admin") {
            if (idUsuario) {
                const esCreador = t.usuario === idUsuario;
                const esCompanero = t.companeros && t.companeros.includes(idUsuario);
                if (!esCreador && !esCompanero) return false; 
            }
            if (idEquipo && t.equipo !== idEquipo) return false;
        }

        if (fInicio || fFin) {
            const fTarea = new Date(convertirAFechaInput(t.fecha_inicio));
            if (fInicio && fTarea < new Date(fInicio)) return false;
            if (fFin && fTarea > new Date(fFin)) return false;
        }
        return true;
    });

    const panel = bootstrap.Offcanvas.getInstance(document.getElementById('panelFiltros'));
    if(panel) panel.hide();
    renderizarTareas(tareas);
}

function limpiarFiltrosLaterales() {
    const selectFiltroLugar = document.getElementById("filtro_lugar");
    if (selectFiltroLugar && selectFiltroLugar.tomselect) selectFiltroLugar.tomselect.clear();
    else if (selectFiltroLugar) selectFiltroLugar.value = "";

    document.getElementById("filtro_estado").value = "";
    document.getElementById("filtro_tipo").value = "";
    document.getElementById("filtro_fecha_inicio").value = "";
    document.getElementById("filtro_fecha_fin").value = "";
    
    if(rolValidado === "admin"){
        document.getElementById("filtro_usuario").value = "";
        document.getElementById("filtro_equipo").value = "";
    }
    aplicarFiltrosPrincipales(); 
}

function cargarListadoTareas() { aplicarFiltrosPrincipales(); }

function abrirListadoActualizado() {
    const btnFiltro = document.getElementById("buscadorPartes");
    if(btnFiltro) btnFiltro.placeholder = "Sincronizando base de datos...";
    cargarDatosDesdeAPI(false, "tareas").then(() => {
        if(btnFiltro) btnFiltro.placeholder = "Buscar texto libre...";
        aplicarFiltrosPrincipales();
        navegarA('list-section');
    });
}

function eliminarTarea(idTarea) {
    if (confirm("¿Estás seguro de que deseas eliminar este parte?\nEsta acción no se puede deshacer.")) {
        const payload = { modo: "eliminar", idRegistro: idTarea };
        fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        })
        .then(response => response.json())
        .then(data => {
            if(data.estado === "ok") {
                alert("🗑️ Parte eliminado correctamente.");
                cargarDatosDesdeAPI(false, "tareas").then(() => aplicarFiltrosPrincipales());
            } else alert("❌ Error al eliminar: " + data.error);
        }).catch(error => alert("⚠️ Error de red al eliminar."));
    }
}

function renderizarTareas(listaTareas) {
    const contenedor = document.getElementById("contenedorListaTareas");
    contenedor.innerHTML = ""; 
    
    if(listaTareas.length === 0) {
        contenedor.innerHTML = "<div class='text-center text-muted mt-5 mb-5'><i class='bi bi-inbox fs-1'></i><p>No se encontraron partes.</p></div>";
        return;
    }

    const tareasPorMes = {};
    listaTareas.forEach(tarea => {
        let mesAnio = "FECHA DESCONOCIDA";
        const d = new Date(convertirAFechaInput(tarea.fecha_inicio));
        if (!isNaN(d)) mesAnio = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
        if(!tareasPorMes[mesAnio]) tareasPorMes[mesAnio] = [];
        tareasPorMes[mesAnio].push(tarea);
    });

    let htmlLista = "";
    for (const [mes, tareas] of Object.entries(tareasPorMes)) {
        htmlLista += `<h5 class="fw-bold text-dark text-uppercase border-bottom border-dark pb-2 mt-4 mb-3">${mes}</h5>`;
        tareas.forEach(tarea => {
            const nombreLugar = datosApp.clientes.find(c => c.id === tarea.lugar)?.nombre || "Lugar desconocido";
            const nombreEstado = datosApp.estados.find(e => e.id === tarea.estado)?.nombre || tarea.estado;
            const nombreTipo = datosApp.tipologias.find(t => t.id === tarea.tipo)?.nombre || tarea.tipo;
            const fInicioCorta = formatoFechaCorta(tarea.fecha_inicio);
            const fFinCorta = formatoFechaCorta(tarea.fecha_fin);
            
            let badgeColor = "bg-info text-dark", iconEstado = "bi-info-circle", colorCajaIzquierda = "bg-info text-white";
            const estL = nombreEstado.toLowerCase();
            
            if(estL.includes("pendiente") || estL.includes("curso") || estL.includes("proceso")) {
                badgeColor = "bg-warning text-dark"; iconEstado = "bi-clock-history"; colorCajaIzquierda = "bg-warning text-dark";
            } else if(estL.includes("resuelto") || estL.includes("cerrado") || estL.includes("fin")) {
                badgeColor = "bg-success text-white"; iconEstado = "bi-check-circle"; colorCajaIzquierda = "bg-success text-white";
            }

            let badgeCompaneros = "";
            if (tarea.usuario !== usuarioValidado && tarea.companeros && tarea.companeros.includes(usuarioValidado)) {
                badgeCompaneros = `<span class="badge bg-secondary px-2 py-1"><i class="bi bi-people-fill"></i> Compartida contigo</span>`;
            } else if (tarea.usuario === usuarioValidado && tarea.companeros && tarea.companeros !== "") {
                badgeCompaneros = `<span class="text-dark small border px-2 py-1 rounded bg-light"><i class="bi bi-people"></i> Trabajo en equipo</span>`;
            }

            htmlLista += `
                <div class="bg-white p-3 border rounded mb-3 shadow-sm d-flex align-items-md-center flex-column flex-md-row gap-3">
                    <div class="${colorCajaIzquierda} rounded px-3 py-2 shadow-sm d-flex align-items-center justify-content-center" style="min-width: 70px; min-height: 70px;">
                        <i class="bi ${iconEstado} fs-2"></i>
                    </div>
                    <div class="flex-grow-1">
                        <div class="mb-1">
                            <span class="fw-bold text-dark fs-5 me-2">${nombreLugar}</span>
                            <span class="fst-italic text-secondary">${tarea.descripcion_corta || ""}</span>
                        </div>
                        <div class="d-flex flex-wrap align-items-center gap-2 mt-2 mt-md-1">
                            <span class="badge ${badgeColor} px-2 py-1">${nombreEstado}</span>
                            <span class="badge bg-secondary px-2 py-1">${nombreTipo}</span>
                            <span class="text-dark small border px-2 py-1 rounded bg-light"><i class="bi bi-calendar-event text-muted"></i> ${fInicioCorta} - ${fFinCorta}</span>
                            ${badgeCompaneros}
                        </div>
                    </div>
                    <div class="d-flex flex-row flex-md-column gap-2 justify-content-end" style="min-width: 120px;">
                        <button class="btn btn-sm btn-outline-primary w-100 fw-bold shadow-sm" onclick="prepararEdicion('${tarea.id}', 'list-section')"><i class="bi bi-pencil-square"></i> Modificar</button>
                        <button class="btn btn-sm btn-outline-danger w-100 fw-bold shadow-sm" onclick="eliminarTarea('${tarea.id}')"><i class="bi bi-trash"></i> Eliminar</button>
                    </div>
                </div>
            `;
        });
    }
    contenedor.innerHTML = htmlLista;
}

// ----------------------------------------------------
// MODO EDICIÓN DEL PARTE DE TRABAJO (CON MODO FANTASMA)
// ----------------------------------------------------
function prepararEdicion(idTarea, origen = 'list-section') {
    origenNavegacion = origen;
    let idLimpio = String(idTarea).trim().toLowerCase().replace(/^id\s*/, "");
    const tarea = (datosApp.tareas || []).find(t => String(t.id || "").trim().toLowerCase().replace(/^id\s*/, "") === idLimpio);
    if(!tarea) return;

    modoEdicionId = tarea.id;
    actualizarVisibilidadAdmin();

    if (document.getElementById("lugar") && document.getElementById("lugar").tomselect) {
        document.getElementById("lugar").tomselect.setValue(tarea.lugar);
    } else if (document.getElementById("lugar")) document.getElementById("lugar").value = tarea.lugar;

    document.getElementById("tipo").value = tarea.tipo;
    document.getElementById("estado").value = tarea.estado;
    document.getElementById("descripcion_corta").value = tarea.descripcion_corta || "";
    document.getElementById("fecha_inicio").value = convertirAFechaInput(tarea.fecha_inicio);
    document.getElementById("fecha_fin").value = convertirAFechaInput(tarea.fecha_fin);

    let textoLimpio = tarea.parte || "";
    const regex = /^\[.*?\] - /;
    if(regex.test(textoLimpio)) textoLimpio = textoLimpio.replace(regex, "");
    document.getElementById("parte").value = textoLimpio; 

    // CARGA DE METADATOS DE ADMINISTRACIÓN (Tanto visualmente como en DOM oculto)
    document.getElementById("meta_nota").value = tarea.nota || "";
    document.getElementById("meta_fecha_solicitud").value = convertirAFechaInput(tarea.fecha_solicitud || tarea.fechaSolicitud) || "";
    document.getElementById("meta_idOrigen").value = tarea.idOrigen || tarea.origen || "";
    document.getElementById("meta_idSolicitante").value = tarea.idSolicitante || tarea.solicitante || "";
    document.getElementById("meta_asignadoPor").value = tarea.asignadoPor || tarea.asignado_por || "";
    document.getElementById("meta_etiquetas").value = tarea.etiquetas || "";
    document.getElementById("meta_equipo").value = tarea.equipo || "";

    // MODO FANTASMA - Determinar a qué equipo y usuario pertenece la tarea para cargar la UI
    let equipoObjetivoUI = equipoValidado; 
    if (rolValidado === 'admin') {
        let usuarioDueño = (datosApp.usuarios || []).find(u => u.id === tarea.usuario);
        // Si hay dueño técnico, preseleccionar su nombre en el input Admin Ghost Mode
        if (usuarioDueño && document.getElementById("admin_tecnico_estandar")) {
            document.getElementById("admin_tecnico_estandar").value = `${usuarioDueño.nombre} - ${usuarioDueño.id}`;
            equipoObjetivoUI = usuarioDueño.extra || usuarioDueño.equipo;
        }
        // Si la tarea tiene equipo forzado en la DB (Col L), tiene prioridad
        if (tarea.equipo) equipoObjetivoUI = tarea.equipo;
    }

    cargarCompanerosEquipo(equipoObjetivoUI, tarea.companeros);

    // Imágenes
    const cargarMini = (urlFull, contenedor, imgId, urlOcultaId, fileInputId) => {
        if(urlFull && urlFull.includes("http")) {
            let idArch = "";
            if (urlFull.includes("id=")) idArch = urlFull.split("id=")[1].split("&")[0];
            else if (urlFull.includes("/file/d/")) idArch = urlFull.split("/file/d/")[1].split("/")[0];

            if (idArch) {
                document.getElementById(contenedor).style.display = "block";
                document.getElementById(imgId).src = "https://drive.google.com/thumbnail?id=" + idArch + "&sz=w400";
                document.getElementById(urlOcultaId).value = urlFull; 
                document.getElementById(fileInputId).style.display = "none"; 
                return;
            }
        }
        document.getElementById(contenedor).style.display = "none";
        document.getElementById(urlOcultaId).value = "";
        document.getElementById(imgId).src = "";
        document.getElementById(fileInputId).style.display = "block";
        document.getElementById(fileInputId).value = "";
    };

    cargarMini(tarea.imagen, "contenedor_mini_imagen", "mini_imagen_preview", "imagen_actual_url", "imagen");
    cargarMini(tarea.imagen2, "contenedor_mini_imagen2", "mini_imagen_preview2", "imagen_actual_url2", "imagen2");

    document.querySelector("#form-section .card-title").innerText = "Modificar Parte";
    document.getElementById("btnEnviarParte").innerHTML = '<i class="bi bi-arrow-repeat"></i> Actualizar Parte';
    
    const btnVolver = document.querySelector("#form-section .btn-outline-secondary");
    if (btnVolver) {
        if (origen === 'informes-section') {
            btnVolver.innerHTML = '<i class="bi bi-arrow-left"></i> Volver a Informes';
            btnVolver.setAttribute("onclick", "limpiarFormulario(); navegarA('informes-section')");
        } else {
            btnVolver.innerHTML = '<i class="bi bi-arrow-left"></i> Volver al Listado';
            btnVolver.setAttribute("onclick", "limpiarFormulario(); navegarA('list-section')");
        }
    }
    navegarA('form-section');
}

function limpiarFormulario() {
    modoEdicionId = null; 
    document.getElementById("formularioTareas").reset();
    
    if(document.getElementById("lugar") && document.getElementById("lugar").tomselect) {
        document.getElementById("lugar").tomselect.clear();
    }
    configurarFechasPorDefecto();
    quitarImagenPrevia();
    quitarImagenPrevia2();

    const hoyISO = new Date().toISOString().split('T')[0];
    document.getElementById("meta_fecha_solicitud").value = hoyISO;
    document.getElementById("meta_idOrigen").value = "16";
    document.getElementById("meta_idSolicitante").value = "167";
    document.getElementById("meta_asignadoPor").value = "almacen.ibi@gmail.com";
    document.getElementById("meta_etiquetas").value = "";
    document.getElementById("meta_nota").value = "";
    document.getElementById("meta_equipo").value = equipoValidado || "";
    if(document.getElementById("admin_tecnico_estandar")) document.getElementById("admin_tecnico_estandar").value = "";

    actualizarVisibilidadAdmin();
    cargarCompanerosEquipo(equipoValidado, "");
    
    document.querySelector("#form-section .card-title").innerText = "Nuevo Parte de Trabajo";
    const btn = document.getElementById("btnEnviarParte");
    btn.innerHTML = '<i class="bi bi-send-check"></i> Enviar Parte';
    btn.disabled = false;
    
    const btnVolver = document.querySelector("#form-section .btn-outline-secondary");
    if(btnVolver) {
        btnVolver.innerHTML = '<i class="bi bi-arrow-left"></i> Volver al menú';
        btnVolver.setAttribute("onclick", "limpiarFormulario(); navegarA('menu-section')");
    }
}

function accionVolver() {
    if (modoEdicionId) {
        limpiarFormulario();
        cargarListadoTareas(); 
        navegarA('list-section');
    } else {
        limpiarFormulario();
        navegarA('menu-section');
    }
}

function quitarImagenPrevia() {
    document.getElementById("contenedor_mini_imagen").style.display = "none";
    document.getElementById("imagen_actual_url").value = "";
    document.getElementById("imagen").style.display = "block";
    document.getElementById("imagen").value = "";
}
function quitarImagenPrevia2() {
    document.getElementById("contenedor_mini_imagen2").style.display = "none";
    document.getElementById("imagen_actual_url2").value = "";
    document.getElementById("imagen2").style.display = "block";
    document.getElementById("imagen2").value = "";
}

// ----------------------------------------------------
// ENVÍO AL BACKEND DEL FORMULARIO DE TAREAS ESTÁNDAR
// ----------------------------------------------------
// Función auxiliar para resolver ID de Origen/Solicitante escrito manualmente
const obtenerIdRegHelper = (valorInput, lista) => {
    if (!valorInput || !lista) return valorInput || "";
    let textoLimpio = valorInput.trim().toLowerCase();
    let encontrado = lista.find(item => 
        (item.nombre && item.nombre.trim().toLowerCase() === textoLimpio) ||
        (item.id && String(item.id).trim().toLowerCase() === textoLimpio)
    );
    if (encontrado) return encontrado.id;
    return valorInput.trim();
};

document.getElementById("formularioTareas").addEventListener("submit", function(e) {
    e.preventDefault(); 
    
    const btnEnviar = document.getElementById("btnEnviarParte");
    btnEnviar.disabled = true;
    btnEnviar.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Guardando...';

    const fInicio = new Date(document.getElementById("fecha_inicio").value);
    const fFin = new Date(document.getElementById("fecha_fin").value);
    const diffTiempo = Math.abs(fFin - fInicio);
    const dias = Math.ceil(diffTiempo / (1000 * 60 * 60 * 24)) + 1; 
    
    const fechaHoy = new Date().toLocaleDateString('es-ES');
    const textoParteFinal = `[${fechaHoy} | ${dias} Días] - ${document.getElementById("parte").value}`;
    
    // MODO FANTASMA: Resolver Usuario Creador (Col K) y Asignado Por (Col P)
    let usuarioAsignado = usuarioValidado; 
    let adminQueAsigna = ""; 

    if (rolValidado === 'admin') {
        let elInputAdmin = document.getElementById("admin_tecnico_estandar");
        if (elInputAdmin && elInputAdmin.value) {
            let valorInput = elInputAdmin.value;
            usuarioAsignado = valorInput.includes(" - ") ? valorInput.split(" - ")[1].trim() : valorInput.trim();
            adminQueAsigna = usuarioValidado;
        }
    }

    // Compañeros
    let seleccionados = obtenerCompanerosSeleccionados(); 
    let listaComp = seleccionados ? seleccionados.split(';').map(e => e.trim()).filter(Boolean) : [];
    let emailEditor = (usuarioValidado || "").trim().toLowerCase();

    // Si NO es admin, auto-aseguramos que el editor consta en la lista (si es de su equipo)
    if (rolValidado !== 'admin' && emailEditor && !listaComp.some(e => e.toLowerCase() === emailEditor)) {
        listaComp.unshift(emailEditor);
    }
    let companerosTexto = listaComp.join(';');

    // Base existente (para conservación)
    let tareaOriginal = null;
    if (modoEdicionId) {
        let idLimpio = String(modoEdicionId).trim().toLowerCase().replace(/^id\s*/, "");
        tareaOriginal = (datosApp.tareas || []).find(t => String(t.id || "").trim().toLowerCase().replace(/^id\s*/, "") === idLimpio);
    }

    // Recogida de Metadatos. Regla: Si es Admin usa lo del DOM (lo haya editado o no). Si NO es Admin, conserva lo que hubiera en la BD.
    let valNota = "", valIdOrigen = "", valIdSolicitante = "", valAsignadoPor = "", valEtiquetas = "", valFechaSolicitud = "", valEquipo = "";
    
    const fechaHoyISO = new Date().toISOString().split('T')[0];

    if (rolValidado === 'admin') {
        valNota = document.getElementById("meta_nota").value;
        valIdOrigen = obtenerIdRegHelper(document.getElementById("meta_idOrigen").value, datosApp.origenes || datosApp.ubicaciones);
        valIdSolicitante = obtenerIdRegHelper(document.getElementById("meta_idSolicitante").value, datosApp.solicitantes);
        valAsignadoPor = document.getElementById("meta_asignadoPor").value || adminQueAsigna;
        valEtiquetas = document.getElementById("meta_etiquetas").value;
        valFechaSolicitud = document.getElementById("meta_fecha_solicitud").value || fechaHoyISO;
        valEquipo = document.getElementById("meta_equipo").value;
    } else {
        valNota = tareaOriginal ? (tareaOriginal.nota || "") : "";
        valIdOrigen = tareaOriginal ? (tareaOriginal.idOrigen || tareaOriginal.origen || "") : "16";
        valIdSolicitante = tareaOriginal ? (tareaOriginal.idSolicitante || tareaOriginal.solicitante || "") : "167";
        valAsignadoPor = tareaOriginal ? (tareaOriginal.asignadoPor || tareaOriginal.asignado_por || "") : "almacen.ibi@gmail.com";
        valEtiquetas = tareaOriginal ? (tareaOriginal.etiquetas || "") : "";
        valFechaSolicitud = tareaOriginal ? (tareaOriginal.fecha_solicitud || tareaOriginal.fechaSolicitud || "") : fechaHoyISO;
        valEquipo = tareaOriginal ? (tareaOriginal.equipo || "") : equipoValidado;
    }

    const payload = {
        modo: modoEdicionId ? "editar" : "crear", 
        idRegistro: modoEdicionId,
        lugar: document.getElementById("lugar").value,
        tipo: document.getElementById("tipo").value,
        estado: document.getElementById("estado").value,
        descripcion_corta: document.getElementById("descripcion_corta").value,
        fecha_inicio: document.getElementById("fecha_inicio").value,
        fecha_fin: document.getElementById("fecha_fin").value,
        parte: textoParteFinal,
        
        usuario: usuarioAsignado,
        asignadoPor: valAsignadoPor,
        equipo: valEquipo,
        companeros: companerosTexto,
        
        nota: valNota,
        idOrigen: valIdOrigen,
        idSolicitante: valIdSolicitante,
        etiquetas: valEtiquetas,
        fecha_solicitud: valFechaSolicitud,
        
        imagenBase64: "", mimeType: "", nombreArchivo: "", imagen_actual_url: document.getElementById("imagen_actual_url").value, 
        imagen2Base64: "", mimeType2: "", nombreArchivo2: "", imagen_actual_url2: document.getElementById("imagen_actual_url2").value
    };

    const idLugarSelec = document.getElementById("lugar").value;
    const clienteObj = (datosApp.clientes || []).find(c => c.id === idLugarSelec);
    const nombreLugar = clienteObj ? clienteObj.nombre : "Lugar";
    const lugarNormalizado = nombreLugar.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_");

    const inputImagen = document.getElementById("imagen");
    const inputImagen2 = document.getElementById("imagen2");

    function enviarPeticionFinal() { enviarAlBackend(payload, btnEnviar); }

    function procesarImagen2() {
        if (inputImagen2 && inputImagen2.files.length > 0) {
            const archivo2 = inputImagen2.files[0];
            const reader2 = new FileReader();
            reader2.onload = function(ev) {
                payload.imagen2Base64 = ev.target.result.split(',')[1];
                payload.mimeType2 = archivo2.type;
                payload.nombreArchivo2 = lugarNormalizado + "_" + archivo2.name.replace(/[^a-zA-Z0-9.]/g, "_") + "_POST";
                enviarPeticionFinal();
            };
            reader2.readAsDataURL(archivo2);
        } else enviarPeticionFinal();
    }

    if (inputImagen && inputImagen.files.length > 0) {
        const archivo = inputImagen.files[0];
        const reader = new FileReader();
        reader.onload = function(ev) {
            payload.imagenBase64 = ev.target.result.split(',')[1];
            payload.mimeType = archivo.type;
            payload.nombreArchivo = lugarNormalizado + "_" + archivo.name.replace(/[^a-zA-Z0-9.]/g, "_") + "_PRE";
            procesarImagen2();
        };
        reader.readAsDataURL(archivo);
    } else procesarImagen2();
});

function enviarAlBackend(payload, btn) {
    fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    })
    .then(response => response.json())
    .then(data => {
        if(data.estado === "ok") {
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Sincronizando...';
            cargarDatosDesdeAPI(false).then(() => {
                alert("✅ ¡Parte guardado correctamente!");
                limpiarFormulario();
                if (payload.modo === "editar") {
                    if (typeof origenNavegacion !== 'undefined' && origenNavegacion === 'informes-section') {
                        generarInforme(); navegarA('informes-section');
                    } else {
                        cargarListadoTareas(); navegarA('list-section');
                    }
                    origenNavegacion = 'list-section';
                } else navegarA('menu-section');
            });
        } else {
            alert("❌ Error al guardar en Sheets: " + data.error);
            btn.disabled = false;
            btn.innerHTML = payload.modo === "editar" ? '<i class="bi bi-arrow-repeat"></i> Actualizar Parte' : '<i class="bi bi-send-check"></i> Enviar Parte';
        }
    })
    .catch(error => {
        console.error("Error en POST:", error);
        alert("⚠️ Error de red al enviar el parte.");
        btn.disabled = false;
        btn.innerHTML = payload.modo === "editar" ? '<i class="bi bi-arrow-repeat"></i> Actualizar Parte' : '<i class="bi bi-send-check"></i> Enviar Parte';
    });
}

// MÓDULO DE INFORMES
function generarInforme() {
    const dInicio = new Date(document.getElementById("informe_fecha_inicio").value);
    const fFinVal = document.getElementById("informe_fecha_fin").value;
    if (isNaN(dInicio)) { alert("⚠️ Selecciona una Fecha de Inicio."); return; }
    
    const dFin = fFinVal ? new Date(fFinVal) : new Date(dInicio);
    let tareasFiltradas = obtenerMisTareasBase().filter(t => {
        const f = new Date(convertirAFechaInput(t.fecha_inicio));
        return f >= dInicio && f <= dFin;
    });
    tareasFiltradas.sort((a, b) => new Date(convertirAFechaInput(a.fecha_inicio)) - new Date(convertirAFechaInput(b.fecha_inicio)));
    renderizarInforme(tareasFiltradas);
}

function renderizarInforme(lista) {
    const contenedor = document.getElementById("informeVisual");
    if (lista.length === 0) {
        contenedor.innerHTML = "<div class='text-center text-muted mt-5 mb-5'><i class='bi bi-inbox fs-1'></i><p>No se encontraron partes.</p></div>";
        return;
    }

    const vTip = document.getElementById("chk_inf_tipo") ? document.getElementById("chk_inf_tipo").checked : true;
    const vFec = document.getElementById("chk_inf_fechas") ? document.getElementById("chk_inf_fechas").checked : true;
    const vDia = document.getElementById("chk_inf_dias") ? document.getElementById("chk_inf_dias").checked : true;
    const vEq = document.getElementById("chk_inf_equipo") ? document.getElementById("chk_inf_equipo").checked : true;

    const tareasPorMes = {};
    lista.forEach(t => {
        let mes = "DESCONOCIDA";
        const d = new Date(convertirAFechaInput(t.fecha_inicio));
        if (!isNaN(d)) mes = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
        if(!tareasPorMes[mes]) tareasPorMes[mes] = [];
        tareasPorMes[mes].push(t);
    });

    let html = "", cont = 1;
    for (const [mes, tareas] of Object.entries(tareasPorMes)) {
        html += `<h5 class="fw-bold text-dark text-uppercase border-bottom border-dark pb-2 mt-4 mb-3">${mes}</h5>`;
        tareas.forEach(tarea => {
            const nomLug = (datosApp.clientes || []).find(c => c.id === tarea.lugar)?.nombre || tarea.lugar;
            const nomTip = (datosApp.tipologias || []).find(t => t.id === tarea.tipo)?.nombre || tarea.tipo;
            const nomEq = (datosApp.equipos || []).find(e => e.id === tarea.equipo)?.nombre || tarea.equipo;
            const fIniC = formatoFechaCorta(tarea.fecha_inicio), fFinC = formatoFechaCorta(tarea.fecha_fin);
            
            const dif = Math.abs(new Date(convertirAFechaInput(tarea.fecha_fin)) - new Date(convertirAFechaInput(tarea.fecha_inicio)));
            const dias = Math.ceil(dif / (1000*60*60*24)) + 1 || 1;
            const colDias = dias === 1 ? "bg-success" : (dias > 3 ? "bg-danger" : "bg-warning text-dark");

            let eti = "";
            if (vTip) eti += `<span class="badge bg-secondary px-2 py-1">${nomTip}</span> `;
            if (vFec) eti += `<span class="text-dark small border px-2 py-1 rounded bg-light"><i class="bi bi-calendar-event"></i> ${fIniC} - ${fFinC}</span> `;
            if (vDia) eti += `<span class="badge ${colDias} px-2 py-1">${dias} Día(s)</span> `;
            if (vEq) eti += `<span class="badge bg-dark px-2 py-1">${nomEq}</span>`;

            html += `
                <div class="bg-white p-3 border rounded mb-3 shadow-sm d-flex align-items-md-center flex-column flex-md-row gap-3 html2pdf__page-break-avoid">
                    <div class="bg-primary text-white rounded px-3 py-2 fw-bold fs-4 text-center" style="min-width: 70px;">#${cont++}</div>
                    <div class="flex-grow-1">
                        <div class="mb-1"><span class="fw-bold text-dark fs-5 me-2">${nomLug}</span><span class="fst-italic text-secondary">${tarea.descripcion_corta || ""}</span></div>
                        <div class="d-flex flex-wrap align-items-center gap-2 mt-2 mt-md-1">${eti}</div>
                    </div>
                    <div class="d-flex justify-content-end mt-3 mt-md-0" data-html2canvas-ignore="true">
                        <button class="btn btn-sm btn-outline-primary fw-bold shadow-sm" onclick="prepararEdicion('${tarea.id}', 'informes-section')"><i class="bi bi-pencil-square"></i> Ver / Editar</button>
                    </div>
                </div>`;
        });
    }
    contenedor.innerHTML = html;
}

function exportarPDF() {
    const el = document.getElementById("informeVisual");
    if (el.innerHTML.includes('bi-inbox')) { alert("No hay datos para exportar."); return; }
    const btn = document.getElementById("btnExportarPDF");
    const txtOrig = btn.innerHTML;
    btn.innerHTML = '<i class="spinner-border spinner-border-sm"></i> Generando...';
    html2pdf().set({ margin: 10, filename: 'Informe.pdf', html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(el).save().then(() => btn.innerHTML = txtOrig);
}

// FORMULARIO ASIGNACIÓN EXCLUSIVO ADMIN
function inicializarFormularioAdmin() {
    const cDl = (id, list) => {
        const el = document.getElementById(id);
        if(!el) return; el.innerHTML = '';
        (list||[]).forEach(i => { let o = document.createElement("option"); o.value = i.nombre; el.appendChild(o); });
    };
    cDl("listaOrigenes", datosApp.origenes); cDl("listaSolicitantes", datosApp.solicitantes);
    cDl("listaEquiposAdmin", datosApp.equipos); cDl("listaLugaresAdmin", datosApp.clientes); cDl("listaUbicacionesAdmin", datosApp.ubicaciones);

    const cSel = (id, list) => {
        const el = document.getElementById(id);
        if(!el) return; el.innerHTML = '<option value="">Selecciona...</option>';
        (list||[]).forEach(i => { let o = document.createElement("option"); o.value = i.id || i.nombre; o.text = i.nombre; el.appendChild(o); });
    };
    cSel("admin_lugar", datosApp.clientes); cSel("admin_tipo", datosApp.tipologias); cSel("admin_estado", datosApp.estados);

    const cAct = document.getElementById("admin_contenedor_actuaciones");
    if (cAct) {
        cAct.innerHTML = '';
        (datosApp.notas || []).forEach((n, i) => {
            cAct.innerHTML += `<input type="checkbox" class="btn-check check-actuacion" id="adm_nota_${i}" value="${n.id}"><label class="btn btn-outline-info rounded-pill shadow-sm mb-2 me-2" for="adm_nota_${i}">${n.id}</label>`;
        });
    }

    const cComp = document.getElementById("admin_contenedorCompaneros");
    if (cComp) {
        cComp.innerHTML = '';
        (datosApp.usuarios || []).forEach((u, i) => {
            let nEq = u.extra || u.equipo || 'Sin equipo';
            cComp.innerHTML += `<div class="form-check border bg-white px-3 py-1 rounded shadow-sm contenedor-companero"><input class="form-check-input check-companero" type="checkbox" value="${u.id}" data-equipo="${nEq}" id="adm_comp_${i}"><label class="form-check-label small" for="adm_comp_${i}">${u.nombre} | <span class="text-muted">${nEq.split('-')[0]}</span></label></div>`;
        });
    }
    configurarFiltroEquiposAdmin();
}

function configurarFiltroEquiposAdmin() {
    const el = document.getElementById("admin_equipo");
    if (!el) return;
    const apF = () => {
        let eq = el.value.trim();
        if (!eq) { let me = (datosApp.usuarios||[]).find(u=>u.id===usuarioValidado); eq = me ? (me.extra||me.equipo) : ""; }
        document.querySelectorAll(".check-companero").forEach(cb => {
            let cEq = cb.dataset.equipo, cont = cb.closest('.contenedor-companero');
            if (cEq === eq || !eq) { cb.disabled = false; cont.classList.remove("opacity-50", "bg-light"); } 
            else { cb.disabled = true; cb.checked = false; cont.classList.add("opacity-50", "bg-light"); }
        });
    };
    el.addEventListener("input", apF); apF();
}

function abrirFormularioAdmin() {
    inicializarFormularioAdmin();
    document.getElementById("formularioAdmin").reset();
    document.getElementById("admin_descripcion_corta").value = "";
    document.getElementById("admin_nota").value = "";
    navegarA('admin-form-section');
}

document.getElementById("formularioAdmin").addEventListener("submit", async function(e) {
    e.preventDefault();
    let nodos = Array.from(document.querySelectorAll(".check-companero:checked"));
    if (nodos.length === 0) return alert("Asigna al menos un compañero.");
    let strComp = nodos.map(cb => cb.value).join(";"), usrAsig = nodos[0].value;
    
    let idUbi = obtenerIdRegHelper(document.getElementById("admin_ubicacion")?.value, datosApp.ubicaciones || datosApp.origenes);
    let idSol = obtenerIdRegHelper(document.getElementById("admin_idSolicitante")?.value, datosApp.solicitantes);
    let eti = Array.from(document.querySelectorAll(".check-actuacion:checked")).map(c => c.value).join(";");

    const lImg = (id) => new Promise(res => {
        let file = document.getElementById(id)?.files[0];
        if(!file) return res(null);
        let r = new FileReader();
        r.onload = () => res({b64: r.result.split(',')[1], mime: file.type, name: file.name});
        r.readAsDataURL(file);
    });

    let img1 = await lImg("admin_imagen"), img2 = await lImg("admin_imagen2");
    
    const btn = document.getElementById("btnEnviarAdmin"), tOrig = btn.innerHTML;
    btn.innerHTML = '<i class="spinner-border spinner-border-sm"></i> Guardando...'; btn.disabled = true;

    const payload = {
        modo: "crear", lugar: document.getElementById("admin_lugar").value, tipo: document.getElementById("admin_tipo").value,
        estado: document.getElementById("admin_estado").value, descripcion_corta: document.getElementById("admin_descripcion_corta").value,
        nota: document.getElementById("admin_nota").value, parte: document.getElementById("admin_parte").value,
        fecha_inicio: document.getElementById("admin_fecha_inicio").value, fecha_fin: document.getElementById("admin_fecha_fin").value,
        fecha_solicitud: document.getElementById("admin_fecha_solicitud").value, equipo: document.getElementById("admin_equipo").value, 
        usuario: usrAsig, companeros: strComp, asignadoPor: usuarioValidado, idOrigen: idUbi, idSolicitante: idSol, etiquetas: eti,
        imagenBase64: img1?.b64||"", mimeType: img1?.mime||"", nombreArchivo: img1?.name||"",
        imagen2Base64: img2?.b64||"", mimeType2: img2?.mime||"", nombreArchivo2: img2?.name||""
    };

    try {
        let r = await fetch(API_URL, { method: "POST", headers: {"Content-Type": "text/plain;charset=utf-8"}, body: JSON.stringify(payload) });
        let resp = await r.json();
        if (resp.estado === "ok") { alert("✅ Parte asignado."); document.getElementById("formularioAdmin").reset(); navegarA('menu-section'); } 
        else alert("❌ Error: " + resp.error);
    } catch (er) { alert("❌ Error de red."); } 
    finally { btn.innerHTML = tOrig; btn.disabled = false; }
});