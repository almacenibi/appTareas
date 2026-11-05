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
    const secTarget = document.getElementById(idSeccion);
    if (secTarget) secTarget.style.display = 'block';
    if(idSeccion !== 'login-section' && idSeccion !== 'loading') {
        const header = document.getElementById('user-header');
        if (header) header.style.display = 'block';
    }
}

document.addEventListener("DOMContentLoaded", function() {
    navegarA('loading');
    cargarDatosDesdeAPI(true);
});

function cargarDatosDesdeAPI(esCargaInicial = false, tipo = "todo") {
    const url = API_URL; 
    console.log("1. Llamando a la API con URL:", url + "&t=" + new Date().getTime());
    
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
                } catch (err) {
                    console.error("Aviso en la preparación inicial de desplegables:", err);
                }
                navegarA('login-section');
            }
        })
        .catch(error => {
            console.error("Error crítico al cargar datos desde API:", error);
            if (esCargaInicial) navegarA('login-section');
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

    // Cargar selector de Equipos para Administración (Col L)
    const selectEquipoAdmin = document.getElementById("meta_equipo");
    if (selectEquipoAdmin) {
        selectEquipoAdmin.innerHTML = '<option value="">Selecciona equipo...</option>';
        (datosApp.equipos || []).forEach(eq => {
            let opt = document.createElement("option");
            opt.value = eq.id || eq.nombre;
            opt.text = eq.nombre;
            selectEquipoAdmin.appendChild(opt);
        });
    }

    // Cargar Datalists auxiliares de Metadatos
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

    if (rolValidado && rolValidado.toLowerCase() === "admin") {
        const zFiltros = document.getElementById("zonaFiltrosAdmin");
        if (zFiltros) zFiltros.classList.remove("opacity-75");
        
        const fUser = document.getElementById("filtro_usuario");
        const fEq = document.getElementById("filtro_equipo");
        if (fUser) fUser.disabled = false;
        if (fEq) fEq.disabled = false;
        
        cargarOpciones("filtro_usuario", datosApp.usuarios);
        cargarOpciones("filtro_equipo", datosApp.equipos);

        if (fUser) fUser.addEventListener("change", aplicarFiltrosPrincipales);
        if (fEq) fEq.addEventListener("change", aplicarFiltrosPrincipales);
    }

    if (typeof TomSelect !== "undefined") {
        let elLugar = document.getElementById("lugar");
        if (elLugar) {
            if (elLugar.tomselect) elLugar.tomselect.destroy();
            new TomSelect("#lugar", { create: false, sortField: { field: "text", direction: "asc" } });
        }

        let elFiltroLugar = document.getElementById("filtro_lugar");
        if (elFiltroLugar) {
            if (elFiltroLugar.tomselect) elFiltroLugar.tomselect.destroy();
            new TomSelect("#filtro_lugar", { create: false, sortField: { field: "text", direction: "asc" } });
        }
    }

    const contenedorAdminTecnico = document.getElementById("contenedor_admin_selector_tecnico");
    const datalistTecnicos = document.getElementById("listaTecnicosAdmin");

    if (rolValidado === 'admin') {
        if (contenedorAdminTecnico) contenedorAdminTecnico.classList.remove("d-none");
        if (datalistTecnicos) datalistTecnicos.innerHTML = '';
        
        if (datosApp.usuarios) {
            datosApp.usuarios.forEach(u => {
                let opt = document.createElement("option");
                opt.value = `${u.nombre} - ${u.id}`;
                datalistTecnicos.appendChild(opt);
            });
        }
    } else {
        if (contenedorAdminTecnico) contenedorAdminTecnico.classList.add("d-none");
    }
}

// 7. Actualiza estado visual de Notas (5.1) y Sección Admin (7.1)
function actualizarVisibilidadSeccionAdmin() {
    const esAdmin = (rolValidado && rolValidado.toLowerCase() === 'admin');
    
    const inputNota = document.getElementById("meta_nota");
    if (inputNota) {
        inputNota.disabled = !esAdmin;
        if (esAdmin) {
            inputNota.classList.remove("bg-light");
        } else {
            inputNota.classList.add("bg-light");
        }
    }

    const secAdmin = document.getElementById("seccion_admin_tarea");
    if (secAdmin) {
        if (esAdmin) {
            secAdmin.classList.remove("d-none");
        } else {
            secAdmin.classList.add("d-none");
        }
    }
}

// 4. Carga dinámica de Compañeros de Equipo (Soporta emulación de equipo para Admin)
function cargarCompanerosEquipo(tarea = null) {
    const contenedor = document.getElementById("contenedorCompaneros");
    if (!contenedor) return;
    contenedor.innerHTML = "";

    let equipoObjetivo = equipoValidado;
    let companerosGuardados = [];

    if (tarea && tarea.companeros) {
        companerosGuardados = tarea.companeros.split(';').map(c => c.trim().toLowerCase()).filter(Boolean);
    }

    // Si es Admin en modo edición: emula el equipo del usuario creador (Col K) o de la tarea (Col L)
    if (rolValidado === 'admin' && tarea) {
        let usuarioCreador = (datosApp.usuarios || []).find(u => 
            (u.id || "").trim().toLowerCase() === (tarea.usuario || "").trim().toLowerCase()
        );
        equipoObjetivo = usuarioCreador ? (usuarioCreador.extra || usuarioCreador.equipo) : (tarea.equipo || equipoValidado);
    }

    let eqObjNorm = (equipoObjetivo || "").toString().trim().toLowerCase();

    // Obtener integrantes del equipo objetivo (usando 'extra' como mapeo en datosApp.usuarios)
    let usuariosDelEquipo = (datosApp.usuarios || []).filter(u => {
        let uEq = (u.extra || u.equipo || "").toString().trim().toLowerCase();
        return uEq === eqObjNorm;
    });

    // Sumar colaboradores asignados en Columna N que pertenezcan a otros equipos
    let idsExistentes = new Set(usuariosDelEquipo.map(u => (u.id || "").trim().toLowerCase()));
    (datosApp.usuarios || []).forEach(u => {
        let uEmail = (u.id || "").trim().toLowerCase();
        if (companerosGuardados.includes(uEmail) && !idsExistentes.has(uEmail)) {
            usuariosDelEquipo.push(u);
            idsExistentes.add(uEmail);
        }
    });

    if (usuariosDelEquipo.length === 0) {
        contenedor.innerHTML = "<span class='text-muted small'>No hay otros compañeros en el equipo.</span>";
        return;
    }

    usuariosDelEquipo.forEach((comp, index) => {
        const idCheck = "chk_" + comp.id.replace(/[@.]/g, "_");
        let emailUser = (comp.id || "").trim().toLowerCase();
        let estaMarcado = companerosGuardados.includes(emailUser);

        contenedor.innerHTML += `
            <div class="form-check form-check-inline border rounded px-2 py-1 bg-white shadow-sm mb-1 ms-0 me-2">
                <input class="form-check-input check-companero ms-0 me-2" type="checkbox" id="${idCheck}" value="${comp.id}" ${estaMarcado ? 'checked' : ''}>
                <label class="form-check-label small" for="${idCheck}">${comp.nombre}</label>
            </div>
        `;
    });
}

function obtenerCompanerosSeleccionados() {
    const checks = document.querySelectorAll("#contenedorCompaneros input[type='checkbox']:checked");
    return Array.from(checks).map(chk => chk.value).join(';');
}

function configurarFechasPorDefecto() {
    const hoy = new Date().toISOString().split('T')[0];
    const fIni = document.getElementById("fecha_inicio");
    const fFin = document.getElementById("fecha_fin");
    if (fIni) fIni.value = hoy;
    if (fFin) fFin.value = hoy;
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
        
        actualizarVisibilidadSeccionAdmin();
        cargarCompanerosEquipo();
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
    if (typeof fechaStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaStr.trim())) {
        return fechaStr.trim();
    }
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

function convertirAFechaInput(fechaStr) {
    return normalizarFecha(fechaStr); 
}

function formatoFechaCorta(fechaStr) {
    let fechaLimpia = normalizarFecha(fechaStr);
    if (!fechaLimpia) return "Sin fecha";
    let partes = fechaLimpia.split('-');
    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return fechaLimpia;
}

function obtenerMisTareasBase() {
    if (rolValidado === "admin") return datosApp.tareas || [];
    return (datosApp.tareas || []).filter(t => 
        t.usuario === usuarioValidado || 
        (t.companeros && t.companeros.includes(usuarioValidado))
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
        
        if (rolValidado && rolValidado.toLowerCase() === "admin") {
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
    if (selectFiltroLugar.tomselect) {
        selectFiltroLugar.tomselect.clear();
    } else {
        selectFiltroLugar.value = "";
    }

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

function cargarListadoTareas() {
    aplicarFiltrosPrincipales();
}

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
                cargarDatosDesdeAPI(false, "tareas").then(() => {
                    aplicarFiltrosPrincipales(); 
                });
            } else {
                alert("❌ Error al eliminar: " + data.error);
            }
        })
        .catch(error => alert("⚠️ Error de red al eliminar."));
    }
}

function renderizarTareas(listaTareas) {
    const contenedor = document.getElementById("contenedorListaTareas");
    contenedor.innerHTML = ""; 
    
    if(listaTareas.length === 0) {
        contenedor.innerHTML = "<div class='text-center text-muted mt-5 mb-5'><i class='bi bi-inbox fs-1'></i><p>No se encontraron partes con estos filtros.</p></div>";
        return;
    }

    const tareasPorMes = {};
    listaTareas.forEach(tarea => {
        let mesAnio = "FECHA DESCONOCIDA";
        const fInput = convertirAFechaInput(tarea.fecha_inicio);
        const d = new Date(fInput);
        if (!isNaN(d)) {
            mesAnio = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
        }
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
            
            let badgeColor = "bg-info text-dark";
            let iconEstado = "bi-info-circle";
            let colorCajaIzquierda = "bg-info text-white";
            
            const estadoLower = nombreEstado.toLowerCase();
            
            if(estadoLower.includes("pendiente") || estadoLower.includes("curso") || estadoLower.includes("proceso")) {
                badgeColor = "bg-warning text-dark";
                iconEstado = "bi-clock-history";
                colorCajaIzquierda = "bg-warning text-dark";
            } else if(estadoLower.includes("resuelto") || estadoLower.includes("cerrado") || estadoLower.includes("fin")) {
                badgeColor = "bg-success text-white";
                iconEstado = "bi-check-circle";
                colorCajaIzquierda = "bg-success text-white";
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
                        <button class="btn btn-sm btn-outline-primary w-100 fw-bold shadow-sm" onclick="prepararEdicion('${tarea.id}', 'list-section')">
                            <i class="bi bi-pencil-square"></i> Modificar
                        </button>
                        <button class="btn btn-sm btn-outline-danger w-100 fw-bold shadow-sm" onclick="eliminarTarea('${tarea.id}')">
                            <i class="bi bi-trash"></i> Eliminar
                        </button>
                    </div>
                </div>
            `;
        });
    }
    contenedor.innerHTML = htmlLista;
}

// MODO EDICIÓN DEL PARTE DE TRABAJO
function prepararEdicion(idTarea, origen = 'list-section') {
    origenNavegacion = origen;
    let idLimpio = String(idTarea).trim().toLowerCase().replace(/^id\s*/, "");
    const tarea = (datosApp.tareas || []).find(t => String(t.id || "").trim().toLowerCase().replace(/^id\s*/, "") === idLimpio);
    if(!tarea) return;

    modoEdicionId = tarea.id;

    if (document.getElementById("lugar").tomselect) {
        document.getElementById("lugar").tomselect.setValue(tarea.lugar);
    } else {
        document.getElementById("lugar").value = tarea.lugar;
    }

    document.getElementById("tipo").value = tarea.tipo;
    document.getElementById("estado").value = tarea.estado;
    document.getElementById("descripcion_corta").value = tarea.descripcion_corta || "";
    document.getElementById("fecha_inicio").value = convertirAFechaInput(tarea.fecha_inicio);
    document.getElementById("fecha_fin").value = convertirAFechaInput(tarea.fecha_fin);

    let textoLimpio = tarea.parte || "";
    const regex = /^\[.*?\] - /;
    if(regex.test(textoLimpio)) {
        textoLimpio = textoLimpio.replace(regex, "");
    }
    document.getElementById("parte").value = textoLimpio; 

    // 5.1 Carga de Notas de Gestión (Columna F)
    document.getElementById("meta_nota").value = tarea.nota || "";

    // 7. Carga de Metadatos Administrativos
    document.getElementById("meta_fecha_solicitud").value = convertirAFechaInput(tarea.fecha_solicitud || tarea.fechaSolicitud) || new Date().toISOString().split('T')[0];
    document.getElementById("meta_idOrigen").value = tarea.idOrigen || tarea.origen || "16";
    document.getElementById("meta_idSolicitante").value = tarea.idSolicitante || tarea.solicitante || "167";
    document.getElementById("meta_asignadoPor").value = tarea.asignadoPor || tarea.asignado_por || "almacen.ibi@gmail.com";
    document.getElementById("meta_etiquetas").value = tarea.etiquetas || "";

    // 7.3 Asignación/Visualización de Equipo (Columna L)
    const selectEquipo = document.getElementById("meta_equipo");
    if (selectEquipo) {
        selectEquipo.value = tarea.equipo || equipoValidado || "";
    }

    actualizarVisibilidadSeccionAdmin();

    // 4. Cargar compañeros de equipo para el parte (Emulando equipo para Admin)
    cargarCompanerosEquipo(tarea);

    // Miniaturas de imágenes (Fotos 1 y 2)
    if(tarea.imagen && tarea.imagen.includes("http")) {
        let urlGuardada = tarea.imagen;
        let idArchivo = "";
        if (urlGuardada.includes("id=")) {
            idArchivo = urlGuardada.split("id=")[1].split("&")[0];
        } else if (urlGuardada.includes("/file/d/")) {
            idArchivo = urlGuardada.split("/file/d/")[1].split("/")[0];
        }

        if (idArchivo) {
            let urlMiniatura = "https://drive.google.com/thumbnail?id=" + idArchivo + "&sz=w400";
            document.getElementById("contenedor_mini_imagen").style.display = "block";
            document.getElementById("mini_imagen_preview").src = urlMiniatura;
            document.getElementById("imagen_actual_url").value = urlGuardada; 
            document.getElementById("imagen").style.display = "none"; 
        } else {
            quitarImagenPrevia();
        }
    } else {
        quitarImagenPrevia();
    }

    if(tarea.imagen2 && tarea.imagen2.includes("http")) {
        let urlGuardada2 = tarea.imagen2;
        let idArchivo2 = "";
        if (urlGuardada2.includes("id=")) {
            idArchivo2 = urlGuardada2.split("id=")[1].split("&")[0];
        } else if (urlGuardada2.includes("/file/d/")) {
            idArchivo2 = urlGuardada2.split("/file/d/")[1].split("/")[0];
        }

        if (idArchivo2) {
            let urlMiniatura2 = "https://drive.google.com/thumbnail?id=" + idArchivo2 + "&sz=w400";
            document.getElementById("contenedor_mini_imagen2").style.display = "block";
            document.getElementById("mini_imagen_preview2").src = urlMiniatura2;
            document.getElementById("imagen_actual_url2").value = urlGuardada2; 
            document.getElementById("imagen2").style.display = "none"; 
        } else {
            quitarImagenPrevia2();
        }
    } else {
        quitarImagenPrevia2();
    }

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
    if(document.getElementById("lugar").tomselect) {
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
    
    const selectEquipo = document.getElementById("meta_equipo");
    if (selectEquipo) selectEquipo.value = equipoValidado || "";

    actualizarVisibilidadSeccionAdmin();
    cargarCompanerosEquipo();
    
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
    document.getElementById("mini_imagen_preview").src = "";
    document.getElementById("imagen").style.display = "block";
    document.getElementById("imagen").value = "";
}

function quitarImagenPrevia2() {
    document.getElementById("contenedor_mini_imagen2").style.display = "none";
    document.getElementById("imagen_actual_url2").value = "";
    document.getElementById("mini_imagen_preview2").src = "";
    document.getElementById("imagen2").style.display = "block";
    document.getElementById("imagen2").value = "";
}

function cancelarEdicionYVolver() {
    limpiarFormulario();
    navegarA('menu-section');
}

// 4. ENVÍO AL BACKEND DEL FORMULARIO DE TAREAS (Blindado para conservar datos)
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

    // Lista de compañeros (Editor + Seleccionados)
    let seleccionados = obtenerCompanerosSeleccionados(); 
    let listaComp = seleccionados ? seleccionados.split(';').map(e => e.trim()).filter(Boolean) : [];
    let emailEditor = (usuarioValidado || "").trim().toLowerCase();

    if (rolValidado !== 'admin' && emailEditor && !listaComp.some(e => e.toLowerCase() === emailEditor)) {
        listaComp.unshift(emailEditor);
    }
    let companerosTexto = listaComp.join(';');

    // 1. Búsqueda de tarea existente para conservación de metadatos
    let tareaOriginal = null;
    if (modoEdicionId) {
        let idLimpio = String(modoEdicionId).trim().toLowerCase().replace(/^id\s*/, "");
        tareaOriginal = (datosApp.tareas || []).find(t => {
            let tIdLimpio = String(t.id || "").trim().toLowerCase().replace(/^id\s*/, "");
            return tIdLimpio === idLimpio;
        });
    }

    // 2. Metadatos (Col F, P, Q, R, S, T y L)
    const elNota = document.getElementById("meta_nota");
    const elOrigen = document.getElementById("meta_idOrigen");
    const elSolicitante = document.getElementById("meta_idSolicitante");
    const elAsignado = document.getElementById("meta_asignadoPor");
    const elEtiquetas = document.getElementById("meta_etiquetas");
    const elFechaSol = document.getElementById("meta_fecha_solicitud");
    const elEquipo = document.getElementById("meta_equipo");

    const fechaHoyISO = new Date().toISOString().split('T')[0];

    let valNota = (elNota && elNota.value.trim() !== "" ? elNota.value.trim() : "") || (tareaOriginal ? (tareaOriginal.nota || "") : "");
    let valIdOrigen = (elOrigen && elOrigen.value.trim() !== "" ? elOrigen.value.trim() : "") || (tareaOriginal ? (tareaOriginal.idOrigen || tareaOriginal.origen || "") : "") || "16";
    let valIdSolicitante = (elSolicitante && elSolicitante.value.trim() !== "" ? elSolicitante.value.trim() : "") || (tareaOriginal ? (tareaOriginal.idSolicitante || tareaOriginal.solicitante || "") : "") || "167";
    let valAsignadoPor = adminQueAsigna || (elAsignado && elAsignado.value.trim() !== "" ? elAsignado.value.trim() : "") || (tareaOriginal ? (tareaOriginal.asignadoPor || tareaOriginal.asignado_por || "") : "") || "almacen.ibi@gmail.com";
    let valEtiquetas = (elEtiquetas && elEtiquetas.value.trim() !== "" ? elEtiquetas.value.trim() : "") || (tareaOriginal ? (tareaOriginal.etiquetas || "") : "") || "";
    let valFechaSolicitud = (elFechaSol && elFechaSol.value.trim() !== "" ? elFechaSol.value.trim() : "") || (tareaOriginal ? (tareaOriginal.fecha_solicitud || tareaOriginal.fechaSolicitud || "") : "") || fechaHoyISO;
    let valEquipo = (elEquipo && elEquipo.value.trim() !== "" ? elEquipo.value.trim() : "") || (tareaOriginal ? (tareaOriginal.equipo || "") : "") || equipoValidado;

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
        
        imagenBase64: "",
        mimeType: "",
        nombreArchivo: "",
        imagen_actual_url: document.getElementById("imagen_actual_url").value, 
        
        imagen2Base64: "",
        mimeType2: "",
        nombreArchivo2: "",
        imagen_actual_url2: document.getElementById("imagen_actual_url2").value
    };

    const idLugarSelec = document.getElementById("lugar").value;
    const clienteObj = datosApp.clientes.find(c => c.id === idLugarSelec);
    const nombreLugar = clienteObj ? clienteObj.nombre : "Lugar";
    const lugarNormalizado = nombreLugar.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_");

    const inputImagen = document.getElementById("imagen");
    const inputImagen2 = document.getElementById("imagen2");

    function enviarPeticionFinal() {
        enviarAlBackend(payload, btnEnviar);
    }

    function procesarImagen2() {
        if (inputImagen2 && inputImagen2.files.length > 0) {
            const archivo2 = inputImagen2.files[0];
            const reader2 = new FileReader();
            reader2.onload = function(evento2) {
                const nombreOriginalLimpio2 = archivo2.name.replace(/[^a-zA-Z0-9.]/g, "_").replace(/_+/g, "_");
                payload.imagen2Base64 = evento2.target.result.split(',')[1];
                payload.mimeType2 = archivo2.type;
                payload.nombreArchivo2 = lugarNormalizado + "_" + nombreOriginalLimpio2 + "_POST";
                enviarPeticionFinal();
            };
            reader2.readAsDataURL(archivo2);
        } else {
            enviarPeticionFinal();
        }
    }

    if (inputImagen && inputImagen.files.length > 0) {
        const archivo = inputImagen.files[0];
        const reader = new FileReader();
        reader.onload = function(evento) {
            const nombreOriginalLimpio = archivo.name.replace(/[^a-zA-Z0-9.]/g, "_").replace(/_+/g, "_");
            payload.imagenBase64 = evento.target.result.split(',')[1];
            payload.mimeType = archivo.type;
            payload.nombreArchivo = lugarNormalizado + "_" + nombreOriginalLimpio + "_PRE";
            procesarImagen2();
        };
        reader.readAsDataURL(archivo);
    } else {
        procesarImagen2();
    }
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
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Sincronizando datos...';
            
            cargarDatosDesdeAPI(false).then(() => {
                alert("✅ ¡Parte guardado correctamente!");
                limpiarFormulario();
                
                if (payload.modo === "editar") {
                    if (typeof origenNavegacion !== 'undefined' && origenNavegacion === 'informes-section') {
                        generarInforme(); 
                        navegarA('informes-section');
                    } else {
                        cargarListadoTareas(); 
                        navegarA('list-section');
                    }
                    origenNavegacion = 'list-section';
                } else {
                    navegarA('menu-section');
                }
            });
        } else {
            alert("❌ Error al guardar en Sheets: " + data.error);
            btn.disabled = false;
            btn.innerHTML = payload.modo === "editar" ? '<i class="bi bi-arrow-repeat"></i> Actualizar Parte' : '<i class="bi bi-send-check"></i> Enviar Parte';
        }
    })
    .catch(error => {
        console.error("Error en POST:", error);
        alert("⚠️ Error de red al enviar el parte. Revisa tu conexión.");
        btn.disabled = false;
        btn.innerHTML = payload.modo === "editar" ? '<i class="bi bi-arrow-repeat"></i> Actualizar Parte' : '<i class="bi bi-send-check"></i> Enviar Parte';
    });
}

document.getElementById("buscadorPartes").addEventListener("input", aplicarFiltrosPrincipales);
document.getElementById("filtroMes").addEventListener("change", aplicarFiltrosPrincipales);

// MÓDULO DE INFORMES
function generarInforme() {
    const fechaInicioVal = document.getElementById("informe_fecha_inicio").value;
    const fechaFinVal = document.getElementById("informe_fecha_fin").value;

    if (!fechaInicioVal) {
        alert("⚠️ Por favor, selecciona al menos una Fecha de Inicio.");
        return;
    }

    const dInicio = new Date(fechaInicioVal);
    const dFin = fechaFinVal ? new Date(fechaFinVal) : new Date(fechaInicioVal);

    let tareas = obtenerMisTareasBase();

    let tareasFiltradas = tareas.filter(t => {
        const fTareaStr = convertirAFechaInput(t.fecha_inicio);
        if (!fTareaStr) return false;
        const fTarea = new Date(fTareaStr);
        return fTarea >= dInicio && fTarea <= dFin;
    });

    tareasFiltradas.sort((a, b) => new Date(convertirAFechaInput(a.fecha_inicio)) - new Date(convertirAFechaInput(b.fecha_inicio)));

    renderizarInforme(tareasFiltradas);
}

function renderizarInforme(lista) {
    const contenedor = document.getElementById("informeVisual");
    contenedor.innerHTML = "";

    if (lista.length === 0) {
        contenedor.innerHTML = "<div class='text-center text-muted mt-5 mb-5'><i class='bi bi-inbox fs-1'></i><p>No se encontraron partes de trabajo en este periodo.</p></div>";
        return;
    }

    const verTipo = document.getElementById("chk_inf_tipo") ? document.getElementById("chk_inf_tipo").checked : true;
    const verFechas = document.getElementById("chk_inf_fechas") ? document.getElementById("chk_inf_fechas").checked : true;
    const verDias = document.getElementById("chk_inf_dias") ? document.getElementById("chk_inf_dias").checked : true;
    const verEquipo = document.getElementById("chk_inf_equipo") ? document.getElementById("chk_inf_equipo").checked : true;

    const tareasPorMes = {};
    lista.forEach(tarea => {
        let mesAnio = "FECHA DESCONOCIDA";
        const fInput = convertirAFechaInput(tarea.fecha_inicio);
        const d = new Date(fInput);
        if (!isNaN(d)) {
            mesAnio = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
        }
        if(!tareasPorMes[mesAnio]) tareasPorMes[mesAnio] = [];
        tareasPorMes[mesAnio].push(tarea);
    });

    let html = "";
    let contadorParte = 1;

    for (const [mes, tareas] of Object.entries(tareasPorMes)) {
        html += `<h5 class="fw-bold text-dark text-uppercase border-bottom border-dark pb-2 mt-4 mb-3">${mes}</h5>`;

        tareas.forEach(tarea => {
            const nombreLugar = datosApp.clientes.find(c => c.id === tarea.lugar)?.nombre || tarea.lugar;
            const nombreTipo = datosApp.tipologias.find(t => t.id === tarea.tipo)?.nombre || tarea.tipo;
            const nombreEquipo = datosApp.equipos.find(e => e.id === tarea.equipo)?.nombre || tarea.equipo;
            
            const fIniCorta = formatoFechaCorta(tarea.fecha_inicio);
            const fFinCorta = formatoFechaCorta(tarea.fecha_fin);

            const dIniT = new Date(convertirAFechaInput(tarea.fecha_inicio));
            const dFinT = new Date(convertirAFechaInput(tarea.fecha_fin));
            let dias = 1;
            if (!isNaN(dIniT) && !isNaN(dFinT)) {
                const difTiempo = Math.abs(dFinT - dIniT);
                dias = Math.ceil(difTiempo / (1000 * 60 * 60 * 24)) + 1; 
            }
            const textoDias = dias === 1 ? "1 Día" : `${dias} Días`;
            
            let colorDias = "bg-info text-dark";
            if (dias === 1) colorDias = "bg-success";
            else if (dias > 3) colorDias = "bg-danger";
            else if (dias > 1) colorDias = "bg-warning text-dark";

            let etiquetasHtml = "";
            if (verTipo) etiquetasHtml += `<span class="badge bg-secondary px-2 py-1">${nombreTipo}</span> `;
            if (verFechas) etiquetasHtml += `<span class="text-dark small border px-2 py-1 rounded bg-light"><i class="bi bi-calendar-event text-muted"></i> ${fIniCorta} - ${fFinCorta}</span> `;
            if (verDias) etiquetasHtml += `<span class="badge ${colorDias} px-2 py-1">${textoDias}</span> `;
            if (verEquipo) etiquetasHtml += `<span class="badge bg-dark px-2 py-1">${nombreEquipo}</span>`;

            html += `
                <div class="bg-white p-3 border rounded mb-3 shadow-sm d-flex align-items-md-center flex-column flex-md-row gap-3 html2pdf__page-break-avoid">
                    <div class="bg-primary text-white rounded px-3 py-2 fw-bold fs-4 shadow-sm text-center" style="min-width: 70px;">
                        #${contadorParte}
                    </div>
                    <div class="flex-grow-1">
                        <div class="mb-1">
                            <span class="fw-bold text-dark fs-5 me-2">${nombreLugar}</span>
                            <span class="fst-italic text-secondary">${tarea.descripcion_corta || ""}</span>
                        </div>
                        <div class="d-flex flex-wrap align-items-center gap-2 mt-2 mt-md-1">
                            ${etiquetasHtml}
                        </div>
                    </div>
                    
                    <div class="d-flex justify-content-end mt-3 mt-md-0" data-html2canvas-ignore="true">
                        <button class="btn btn-sm btn-outline-primary fw-bold shadow-sm" onclick="prepararEdicion('${tarea.id}', 'informes-section')">
                            <i class="bi bi-pencil-square"></i> Ver / Editar
                        </button>
                    </div>
                </div>
            `;
            contadorParte++;
        });
    }
    contenedor.innerHTML = html;
}

function exportarPDF() {
    const elemento = document.getElementById("informeVisual");
    if (elemento.innerHTML.includes('bi-inbox')) {
        alert("No hay datos para exportar. Genera un informe primero.");
        return;
    }

    const opciones = {
        margin:       10,
        filename:     'Informe_Trabajos.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    const btn = document.getElementById("btnExportarPDF");
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="spinner-border spinner-border-sm"></i> Generando...';
    
    html2pdf().set(opciones).from(elemento).save().then(() => {
        btn.innerHTML = textoOriginal;
    });
}

// FORMULARIO DE ASIGNACIÓN ADMIN
function inicializarFormularioAdmin() {
    const cargarDatalist = (datalistId, lista) => {
        const datalist = document.getElementById(datalistId);
        if(!datalist) return;
        datalist.innerHTML = '';
        if (!lista) lista = [];
        lista.forEach(item => {
            let opcion = document.createElement("option");
            opcion.value = item.nombre; 
            datalist.appendChild(opcion);
        });
    };

    cargarDatalist("listaOrigenes", datosApp.origenes);
    cargarDatalist("listaSolicitantes", datosApp.solicitantes);
    cargarDatalist("listaEquiposAdmin", datosApp.equipos);
    cargarDatalist("listaLugaresAdmin", datosApp.clientes);
    cargarDatalist("listaUbicacionesAdmin", datosApp.ubicaciones);

    const cargarSelect = (selectId, lista) => {
        const select = document.getElementById(selectId);
        if(!select) return;
        select.innerHTML = '<option value="">Selecciona...</option>';
        if (!lista) lista = [];
        lista.forEach(item => {
            let opcion = document.createElement("option");
            opcion.value = item.id || item.nombre; 
            opcion.text = item.nombre;
            select.appendChild(opcion);
        });
    };

    cargarSelect("admin_lugar", datosApp.clientes);
    cargarSelect("admin_tipo", datosApp.tipologias);
    cargarSelect("admin_estado", datosApp.estados);

    const contActuaciones = document.getElementById("admin_contenedor_actuaciones");
    if (contActuaciones) {
        contActuaciones.innerHTML = '';
        let notas = datosApp.notas || [];
        notas.forEach((nota, index) => {
            contActuaciones.innerHTML += `
                <input type="checkbox" class="btn-check check-actuacion" id="admin_nota_${index}" value="${nota.id}" autocomplete="off">
                <label class="btn btn-outline-info rounded-pill shadow-sm mb-2 me-2" for="admin_nota_${index}" title="${nota.nombre}">
                    ${nota.id}
                </label>
            `;
        });
    }

    const contCompaneros = document.getElementById("admin_contenedorCompaneros");
    if (contCompaneros) {
        contCompaneros.innerHTML = '';
        let usuarios = datosApp.usuarios || [];
        usuarios.forEach((user, index) => {
            let nombreEq = user.extra || user.equipo || 'Sin equipo';
            let eqCorto = nombreEq !== 'Sin equipo' ? nombreEq.split('-')[0] : nombreEq;
            
            contCompaneros.innerHTML += `
                <div class="form-check border bg-white px-3 py-1 rounded shadow-sm contenedor-companero">
                    <input class="form-check-input check-companero" type="checkbox" value="${user.id}" data-nombre="${user.nombre}" data-equipo="${nombreEq}" id="admin_comp_${index}">
                    <label class="form-check-label small" for="admin_comp_${index}" title="${nombreEq}">
                        ${user.nombre} | <span class="text-muted">${eqCorto}</span>
                    </label>
                </div>
            `;
        });
    }

    automatizarTextosAdmin();
    configurarFiltroEquipos();
}

function configurarFiltroEquipos() {
    const inputEquipo = document.getElementById("admin_equipo");
    if (!inputEquipo) return;

    const aplicarFiltro = () => {
        let equipoSeleccionado = inputEquipo.value.trim();
        
        if (!equipoSeleccionado && datosApp.usuarios) {
            let adminActual = datosApp.usuarios.find(u => u.id === usuarioValidado);
            equipoSeleccionado = adminActual ? (adminActual.extra || adminActual.equipo) : "";
        }

        document.querySelectorAll(".check-companero").forEach(cb => {
            let eqCompanero = cb.dataset.equipo;
            let contenedor = cb.closest('.contenedor-companero');
            
            if (eqCompanero === equipoSeleccionado || !equipoSeleccionado) {
                cb.disabled = false;
                contenedor.classList.remove("opacity-50", "bg-light");
            } else {
                cb.disabled = true;
                cb.checked = false;
                contenedor.classList.add("opacity-50", "bg-light");
            }
        });
    };

    inputEquipo.addEventListener("input", aplicarFiltro);
    aplicarFiltro();
}

function automatizarTextosAdmin() {
    const inputOrigen = document.getElementById("admin_idOrigen");
    const inputUbicacion = document.getElementById("admin_ubicacion");
    const inputDescripcion = document.getElementById("admin_descripcion_corta");
    let ultimoBloqueInicial = "";

    const recalcularTextos = () => {
        let origenValor = inputOrigen ? inputOrigen.value.trim() : "";
        let etiquetaOrigen = origenValor; 
        
        if (origenValor && datosApp.origenes) {
            let origenObj = datosApp.origenes.find(o => o.nombre === origenValor || o.id === origenValor);
            if (origenObj && origenObj.etiqueta) etiquetaOrigen = origenObj.etiqueta;
        }

        let textoOrigen = etiquetaOrigen ? etiquetaOrigen : ""; 
        let ubicacionValor = inputUbicacion ? inputUbicacion.value.trim() : "";
        let textoUbicacion = ubicacionValor ? `[${ubicacionValor}]` : "";

        let nuevoBloqueInicial = [textoOrigen, textoUbicacion].filter(Boolean).join(" ");
        let textoActual = inputDescripcion.value || "";
        let parteIzquierda = textoActual.split("|")[0]; 
        let textoManual = parteIzquierda;
        
        if (ultimoBloqueInicial && parteIzquierda.startsWith(ultimoBloqueInicial)) {
            textoManual = parteIzquierda.substring(ultimoBloqueInicial.length);
        } 
        
        textoManual = textoManual.trim();
        ultimoBloqueInicial = nuevoBloqueInicial;

        let checksActuaciones = document.querySelectorAll(".check-actuacion:checked");
        let textosChecks = Array.from(checksActuaciones).map(cb => `[${cb.value}]`).join(" ");
        
        let izquierdaFinal = [nuevoBloqueInicial, textoManual].filter(Boolean).join(" ");
        let descripcionFinal = izquierdaFinal;
        
        if (textosChecks) {
            descripcionFinal += ` | ${textosChecks}`;
        }
        
        inputDescripcion.value = descripcionFinal.substring(0, 100); 
    };

    if (inputOrigen) inputOrigen.addEventListener("input", recalcularTextos);
    if (inputUbicacion) inputUbicacion.addEventListener("input", recalcularTextos);
    document.addEventListener("change", function(e) {
        if (e.target && e.target.classList.contains("check-actuacion")) recalcularTextos();
    });
}

function abrirFormularioAdmin() {
    inicializarFormularioAdmin();
    document.getElementById("formularioAdmin").reset();
    document.getElementById("admin_descripcion_corta").value = "";
    document.getElementById("admin_nota").value = "";
    navegarA('admin-form-section');
}

// SUBMIT FORMULARIO ADMIN (V29)
document.getElementById("formularioAdmin").addEventListener("submit", async function(e) {
    e.preventDefault();

    let nodosCompaneros = Array.from(document.querySelectorAll(".check-companero:checked"));
    if (nodosCompaneros.length === 0) {
        alert("Debes asignar al menos un compañero de equipo al parte.");
        return; 
    }

    let stringCompaneros = nodosCompaneros.map(cb => cb.value).join(";");
    let usuarioAsignado = nodosCompaneros[0].value;

    const obtenerIdReg = (valorInput, lista) => {
        if (!valorInput || !lista) return valorInput || "";
        let textoLimpio = valorInput.trim().toLowerCase();

        let encontrado = lista.find(item => 
            (item.nombre && item.nombre.trim().toLowerCase() === textoLimpio) ||
            (item.id && item.id.trim().toLowerCase() === textoLimpio)
        );
        if (encontrado) return encontrado.id;

        if (valorInput.includes(" - ")) {
            let partes = valorInput.split(" - ").map(p => p.trim().toLowerCase());
            encontrado = lista.find(item => 
                partes.includes((item.nombre || "").trim().toLowerCase()) ||
                partes.includes((item.id || "").trim().toLowerCase())
            );
            if (encontrado) return encontrado.id;
        }

        return valorInput.trim();
    };

    let valUbicacion = document.getElementById("admin_ubicacion") ? document.getElementById("admin_ubicacion").value : "";
    let valSolicitante = document.getElementById("admin_idSolicitante") ? document.getElementById("admin_idSolicitante").value : "";

    let idUbicacionFinal = obtenerIdReg(valUbicacion, datosApp.ubicaciones || datosApp.origenes);
    let idSolicitanteFinal = obtenerIdReg(valSolicitante, datosApp.solicitantes);

    let etiquetasArray = Array.from(document.querySelectorAll(".check-actuacion:checked")).map(cb => cb.value);
    let stringEtiquetas = etiquetasArray.join(";");

    const leerImagenBase64 = (inputId) => {
        return new Promise((resolve) => {
            let input = document.getElementById(inputId);
            if (input && input.files.length > 0) {
                let reader = new FileReader();
                reader.onload = () => resolve({
                    base64: reader.result.split(',')[1],
                    mime: input.files[0].type,
                    nombre: input.files[0].name
                });
                reader.readAsDataURL(input.files[0]);
            } else {
                resolve(null);
            }
        });
    };

    let img1 = await leerImagenBase64("admin_imagen");
    let img2 = await leerImagenBase64("admin_imagen2");

    const btnSubmit = document.getElementById("btnEnviarAdmin");
    const textoOriginalBtn = btnSubmit.innerHTML;
    btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando en base de datos...';
    btnSubmit.disabled = true;

    const payload = {
        modo: "crear",
        lugar: document.getElementById("admin_lugar").value,
        tipo: document.getElementById("admin_tipo").value,
        estado: document.getElementById("admin_estado").value,
        descripcion_corta: document.getElementById("admin_descripcion_corta").value,
        nota: document.getElementById("admin_nota").value,
        parte: document.getElementById("admin_parte").value,
        fecha_inicio: document.getElementById("admin_fecha_inicio").value,
        fecha_fin: document.getElementById("admin_fecha_fin").value,
        fecha_solicitud: document.getElementById("admin_fecha_solicitud").value,
        equipo: document.getElementById("admin_equipo").value, 
        usuario: usuarioAsignado,
        companeros: stringCompaneros,
        asignadoPor: usuarioValidado,
        idOrigen: idUbicacionFinal,
        idSolicitante: idSolicitanteFinal,
        etiquetas: stringEtiquetas,
        
        imagenBase64: img1 ? img1.base64 : "",
        mimeType: img1 ? img1.mime : "",
        nombreArchivo: img1 ? img1.nombre : "",
        imagen2Base64: img2 ? img2.base64 : "",
        mimeType2: img2 ? img2.mime : "",
        nombreArchivo2: img2 ? img2.nombre : ""
    };

    try {
        let respuesta = await fetch(API_URL, { 
            method: "POST",
            redirect: "follow",
            headers: {
                "Content-Type": "text/plain;charset=utf-8",
            },
            body: JSON.stringify(payload)
        });
        
        let textoCrudo = await respuesta.text(); 
        let resultado;
        
        try {
            resultado = JSON.parse(textoCrudo);
        } catch (parseError) {
            console.error("❌ Respuesta del servidor:", textoCrudo);
            alert("Error interno en el backend. Revisa las ejecuciones en Apps Script.");
            return;
        }
        
        if (resultado.estado === "ok") {
            alert("✅ Parte asignado y guardado correctamente.");
            document.getElementById("formularioAdmin").reset();
            navegarA('menu-section'); 
        } else {
            alert("❌ Error al guardar: " + resultado.error);
        }
    } catch (error) {
        console.error("❌ Error real de conexión:", error);
        alert("❌ Error de red o CORS al enviar el parte. Revisa la consola.");
    } finally {
        btnSubmit.innerHTML = textoOriginalBtn;
        btnSubmit.disabled = false;
    }
});