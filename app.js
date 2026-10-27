
//const API_URL = 'https://script.google.com/macros/s/AKfycbwCKnOnYSIoBSBZsVOecLPvCu0WWWtzN1hynTFRcwUL23Ph7qN_X414SQU1AkBa-bY/exec';
const API_URL = 'https://script.google.com/macros/s/AKfycby_FbRuRypDU8nfaPwoXMshpLGDhmqWrz9P88scCfU8tekKe6RHE4hirbkVX5s-5z4g/exec';
let datosApp = {};
let usuarioValidado = null; 
let equipoValidado = null;  
let rolValidado = null; 
let modoEdicionId = null;
let origenNavegacion = 'list-section'; // Recordará de dónde venimos v17

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
    cargarDatosDesdeAPI(true); // true = es la primera carga (vamos a login)
});

// Función que descarga los datos (sirve para inicio y para refrescar tras guardar) --> v24
// Función que descarga los datos (con interceptores de diagnóstico)
//Esta tardando en actualizar github
function cargarDatosDesdeAPI(esCargaInicial = false, tipo = "todo") {
    const url = API_URL; 
    console.log("1. Llamando a la API con URL:", url + "&t=" + new Date().getTime());
    
    return fetch(url + "?t=" + new Date().getTime()) 
        .then(response => {
            console.log("2. Respuesta del servidor (cruda):", response);
            return response.json();
        })
        .then(data => {
            console.warn("3. ¡PAQUETE JSON DESEMPAQUETADO! Mira lo que tiene dentro:", data);
            
            if(data.clientes) datosApp.clientes = data.clientes;
            if(data.tipologias) datosApp.tipologias = data.tipologias;
            if(data.estados) datosApp.estados = data.estados;
            if(data.equipos) datosApp.equipos = data.equipos;
            if(data.usuarios) datosApp.usuarios = data.usuarios;
            if(data.tareas) datosApp.tareas = data.tareas;
            
            // Verificamos si llegan al embudo
            if(data.origenes) {
                console.log("✔️ Orígenes encontrados y guardados.");
                datosApp.origenes = data.origenes;
            } else {
                console.error("❌ El JSON ha llegado SIN orígenes.");
            }

            if(data.solicitantes) datosApp.solicitantes = data.solicitantes;
            if(data.notas) datosApp.notas = data.notas;
            
            if(data.ubicaciones) datosApp.ubicaciones = data.ubicaciones;

            if(esCargaInicial) {
                rellenarDesplegables();
                configurarFechasPorDefecto();
                navegarA('login-section');
            }
        })
        .catch(error => {
            console.error("Error crítico al cargar datos:", error);
        });
}


//v22 -> revisar que actualice desplegables para admin
function rellenarDesplegables() {
    const cargarOpciones = (selectId, lista) => {
        const select = document.getElementById(selectId);
        if(!select) return; 
        select.innerHTML = '<option value="">Todos...</option>'; 
        if(selectId === 'lugar' || selectId === 'filtro_lugar') select.innerHTML = '<option value="">Selecciona o escribe...</option>';
        
        lista.forEach(item => {
            let opcion = document.createElement("option");
            opcion.value = item.id; 
            opcion.text = item.nombre;
            select.appendChild(opcion);
        });
    };

    // Selectores
    cargarOpciones("lugar", datosApp.clientes);
    cargarOpciones("tipo", datosApp.tipologias);
    cargarOpciones("estado", datosApp.estados);
    cargarOpciones("filtro_lugar", datosApp.clientes);
    cargarOpciones("filtro_estado", datosApp.estados);
    cargarOpciones("filtro_tipo", datosApp.tipologias);

    // Lógica Admin - V21
    if (rolValidado && rolValidado.toLowerCase() === "admin") {
        document.getElementById("zonaFiltrosAdmin").classList.remove("opacity-75");
        document.getElementById("filtro_usuario").disabled = false;
        document.getElementById("filtro_equipo").disabled = false;
        
        cargarOpciones("filtro_usuario", datosApp.usuarios);
        cargarOpciones("filtro_equipo", datosApp.equipos);

        // NUEVO: Decirle a la app que filtre automáticamente cuando el admin cambie estos desplegables
        document.getElementById("filtro_usuario").addEventListener("change", aplicarFiltrosPrincipales);
        document.getElementById("filtro_equipo").addEventListener("change", aplicarFiltrosPrincipales);
    }

    // --- INICIALIZACIÓN DE LOS BUSCADORES (TomSelect) ---
    // Buscador del formulario
    if (document.getElementById("lugar").tomselect) {
        document.getElementById("lugar").tomselect.destroy();
    }
    new TomSelect("#lugar", { create: false, sortField: { field: "text", direction: "asc" } });

    // Buscador del panel de filtros
    if (document.getElementById("filtro_lugar").tomselect) {
        document.getElementById("filtro_lugar").tomselect.destroy();
    }
    new TomSelect("#filtro_lugar", { create: false, sortField: { field: "text", direction: "asc" } });

    //--V26 ADMIN -> SELECTOR USUARIO <-- FORMULARIO ESTANDARD
    // Mostrar y rellenar selector si el usuario es Admin
    // 1. Declaramos los elementos FUERA del if para que existan en ambos casos
    const contenedorAdminTecnico = document.getElementById("contenedor_admin_selector_tecnico");
    const selectAdminTecnico = document.getElementById("admin_tecnico_estandar");
    const datalistTecnicos = document.getElementById("listaTecnicosAdmin");

    // 2. Evaluamos la lógica
    if (rolValidado === 'admin') {
        if (contenedorAdminTecnico) contenedorAdminTecnico.classList.remove("d-none");
        if (datalistTecnicos) datalistTecnicos.innerHTML = ''; // Limpiamos opciones previas
        
        if (datosApp.usuarios) {
            datosApp.usuarios.forEach(u => {
                let opt = document.createElement("option");
                // Formato visual: Aitor Martinez - almacen.ibi@gmail.com
                opt.value = `${u.nombre} - ${u.id}`;
                datalistTecnicos.appendChild(opt);
            });
        }
        
        // Lógica para preseleccionar en edición (si existe)
        if (typeof parteActual !== 'undefined' && parteActual.usuario) {
            let userMatch = datosApp.usuarios.find(u => u.id === parteActual.usuario);
            if (selectAdminTecnico) {
                selectAdminTecnico.value = userMatch ? `${userMatch.nombre} - ${userMatch.id}` : parteActual.usuario;
            }
        }
    } else {
        // Si NO es admin, nos aseguramos de que el selector se mantenga oculto
        if (contenedorAdminTecnico) contenedorAdminTecnico.classList.add("d-none");
    }
    //--V26 ADMIN -> SELECTOR USUARIO <-- FORMULARIO ESTANDARD
}


// Genera los checks dinámicamente filtrando por el equipo del usuario logueado
function cargarCompanerosEquipo() {
    const contenedor = document.getElementById("contenedorCompaneros");
    contenedor.innerHTML = "";
    
    // Buscamos usuarios del mismo equipo, excluyendo al usuario actual
    const misCompaneros = datosApp.usuarios.filter(u => u.extra === equipoValidado && u.id !== usuarioValidado);
    
    if(misCompaneros.length === 0) {
        contenedor.innerHTML = "<span class='text-muted small'>No hay otros compañeros en tu equipo.</span>";
        return;
    }

    misCompaneros.forEach(comp => {
        const idCheck = "chk_" + comp.id.replace(/[@.]/g, "_");
        contenedor.innerHTML += `
            <div class="form-check form-check-inline border rounded px-2 py-1 bg-white shadow-sm mb-0">
                <input class="form-check-input ms-0 me-2" type="checkbox" id="${idCheck}" value="${comp.id}">
                <label class="form-check-label small" for="${idCheck}">${comp.nombre}</label>
            </div>
        `;
    });
}

// Lee qué casillas están marcadas antes de enviar
function obtenerCompanerosSeleccionados() {
    const checks = document.querySelectorAll("#contenedorCompaneros input[type='checkbox']:checked");
    return Array.from(checks).map(chk => chk.value).join(';');
}

function configurarFechasPorDefecto() {
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById("fecha_inicio").value = hoy;
    document.getElementById("fecha_fin").value = hoy;
}

// --- 2. LOGIN ---
document.getElementById("btnLogin").addEventListener("click", function() {
    const emailIngresado = document.getElementById("emailInput").value.trim().toLowerCase();
    const usuarioEncontrado = datosApp.usuarios.find(u => u.id.toLowerCase() === emailIngresado);

    if (usuarioEncontrado) {
        usuarioValidado = usuarioEncontrado.id;
        equipoValidado = usuarioEncontrado.extra;
        rolValidado = usuarioEncontrado.rol || "tecnico"; 

        document.getElementById("headerNombre").innerText = usuarioEncontrado.nombre;
        const equipoObj = datosApp.equipos.find(e => e.id === equipoValidado);
        document.getElementById("headerEquipo").innerText = equipoObj ? equipoObj.nombre : equipoValidado;
        
        // Inyectamos el rol en la cabecera visual
        document.getElementById("headerRol").innerText = rolValidado;
        
        // Cargamos los compañeros
        cargarCompanerosEquipo();

        // ¡AQUÍ ESTÁ LA CLAVE! Re-dibujamos los desplegables ahora que sabemos que es admin
        rellenarDesplegables();

        //<--v24
        // --- ¡NUEVO! MOSTRAR/OCULTAR BOTÓN ADMIN ---
        const btnMenuAdmin = document.getElementById("colMenuAdmin");
        if (btnMenuAdmin) {
            if (rolValidado.trim().toLowerCase() === "admin") {
                btnMenuAdmin.classList.remove("d-none");
            } else {
                btnMenuAdmin.classList.add("d-none");
            }
        }
        //<--v24

        //v26 separar el email del usuario -->

        //<--v26


        navegarA('menu-section');
    } else {
        document.getElementById("loginError").style.display = "block";
    }
});

// --- 3. LISTADO Y EDICIÓN ---

// 1. Motor de fechas: Entiende cualquier cosa que mande Google y lo pasa a AAAA-MM-DD
function normalizarFecha(fechaStr) {
    if (!fechaStr) return "";
    
    // Si ya viene como AAAA-MM-DD desde la base de datos, lo dejamos tal cual
    if (typeof fechaStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaStr.trim())) {
        return fechaStr.trim();
    }

    // Si viene con formato raro ("Mon Oct 19..."), Javascript lo lee y lo traduce
    let d = new Date(fechaStr);
    if (!isNaN(d)) {
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();
        let year = d.getFullYear();
        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;
        return [year, month, day].join('-');
    }
    
    return fechaStr; // Fallback
}

// 2. Para el formulario (exige formato AAAA-MM-DD)
function convertirAFechaInput(fechaStr) {
    return normalizarFecha(fechaStr); 
}

// 3. Para las tarjetas (Lo pone bonito: DD/MM/AAAA)
function formatoFechaCorta(fechaStr) {
    let fechaLimpia = normalizarFecha(fechaStr);
    if (!fechaLimpia) return "Sin fecha";
    
    let partes = fechaLimpia.split('-');
    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`; // Cambia 2026-10-19 a 19/10/2026
    }
    return fechaLimpia;
}

// --- MOTOR DE BÚSQUEDA Y FILTRADO ---

function obtenerMisTareasBase() {
    if (rolValidado === "admin") return datosApp.tareas;
    
    return datosApp.tareas.filter(t => 
        t.usuario === usuarioValidado || 
        (t.companeros && t.companeros.includes(usuarioValidado))
    );
}

// 2. Filtros de la Barra Principal (Buscador y Mes)
function aplicarFiltrosPrincipales() {
    const texto = document.getElementById("buscadorPartes").value.toLowerCase();
    const filtroMes = document.getElementById("filtroMes").value; // "actual" o "todo"
    
    let tareas = obtenerMisTareasBase();
    const mesActual = new Date().getMonth();
    const anoActual = new Date().getFullYear();

    tareas = tareas.filter(t => {
        // Filtro por texto
        let matchTexto = true;
        if (texto !== "") {
            const nomLugar = (datosApp.clientes.find(c => c.id === t.lugar)?.nombre || "").toLowerCase();
            const desc = t.descripcion_corta.toLowerCase();
            matchTexto = nomLugar.includes(texto) || desc.includes(texto);
        }

        // Filtro por mes
        let matchMes = true;
        if (filtroMes === "actual") {
            const fechaT = new Date(convertirAFechaInput(t.fecha_inicio));
            matchMes = (fechaT.getMonth() === mesActual && fechaT.getFullYear() === anoActual);
        }

        return matchTexto && matchMes;
    });

    renderizarTareas(tareas);
}

// 3. Filtros del Panel Lateral (Ignora el buscador principal)
// 3. Filtros del Panel Lateral (Ignora el buscador principal) - v21 - Todo el bloque
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
        
        // --- Filtros Admin Mejorados ---
        if (rolValidado && rolValidado.toLowerCase() === "admin") {
            
            // Si el admin filtra por un usuario concreto (Creador o Compañero)
            if (idUsuario) {
                const esCreador = t.usuario === idUsuario;
                const esCompanero = t.companeros && t.companeros.includes(idUsuario);
                if (!esCreador && !esCompanero) return false; 
            }
            
            // Filtro por equipo
            if (idEquipo && t.equipo !== idEquipo) return false;
        }

        // Rango de fechas
        if (fInicio || fFin) {
            const fTarea = new Date(convertirAFechaInput(t.fecha_inicio));
            if (fInicio && fTarea < new Date(fInicio)) return false;
            if (fFin && fTarea > new Date(fFin)) return false;
        }
        
        return true;
    });

    // Cerramos el panel lateral
    const panel = bootstrap.Offcanvas.getInstance(document.getElementById('panelFiltros'));
    if(panel) panel.hide();

    renderizarTareas(tareas);
}

function limpiarFiltrosLaterales() {
    // Limpiamos el buscador TomSelect si existe
    const selectFiltroLugar = document.getElementById("filtro_lugar");
    if (selectFiltroLugar.tomselect) {
        selectFiltroLugar.tomselect.clear();
    } else {
        selectFiltroLugar.value = "";
    }

    // Limpiamos el resto de filtros estándar
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

// Reemplaza a la antigua cargarListadoTareas
function cargarListadoTareas() {
    aplicarFiltrosPrincipales();
}

// Obliga a bajar las tareas de internet antes de abrir la pantalla
function abrirListadoActualizado() {
    // Mostramos algo visual mientras carga (opcional pero recomendado)
    const btnFiltro = document.getElementById("buscadorPartes");
    if(btnFiltro) btnFiltro.placeholder = "Sincronizando base de datos...";
    
    cargarDatosDesdeAPI(false, "tareas").then(() => {
        if(btnFiltro) btnFiltro.placeholder = "Buscar texto libre...";
        aplicarFiltrosPrincipales();
        navegarA('list-section');
    });
}

// Lógica del botón Eliminar
function eliminarTarea(idTarea) {
    if (confirm("¿Estás seguro de que deseas eliminar este parte?\nEsta acción no se puede deshacer.")) {
        
        const payload = { modo: "eliminar", idRegistro: idTarea };
        
        // Mostramos feedback visual (usamos un alert por simplicidad, pero podrías usar un toast)
        fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        })
        .then(response => response.json())
        .then(data => {
            if(data.estado === "ok") {
                alert("🗑️ Parte eliminado correctamente.");
                // Refrescamos los datos desde Sheets y repintamos
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

        // Agrupamos por mes (Igual que en los informes)
        const tareasPorMes = {};
        listaTareas.forEach(tarea => {
            let mesAnio = "FECHA DESCONOCIDA";
            const fInput = convertirAFechaInput(tarea.fecha_inicio);
            const d = new Date(fInput);
            if (!isNaN(d)) {
                // Formato en mayúsculas como en el informe
                mesAnio = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase();
            }
            if(!tareasPorMes[mesAnio]) tareasPorMes[mesAnio] = [];
            tareasPorMes[mesAnio].push(tarea);
        });

        let htmlLista = "";
        
        for (const [mes, tareas] of Object.entries(tareasPorMes)) {
            // Título del mes idéntico al informe
            htmlLista += `<h5 class="fw-bold text-dark text-uppercase border-bottom border-dark pb-2 mt-4 mb-3">${mes}</h5>`;
            
            tareas.forEach(tarea => {
                const nombreLugar = datosApp.clientes.find(c => c.id === tarea.lugar)?.nombre || "Lugar desconocido";
                const nombreEstado = datosApp.estados.find(e => e.id === tarea.estado)?.nombre || tarea.estado;
                const nombreTipo = datosApp.tipologias.find(t => t.id === tarea.tipo)?.nombre || tarea.tipo;
                
                const fInicioCorta = formatoFechaCorta(tarea.fecha_inicio);
                const fFinCorta = formatoFechaCorta(tarea.fecha_fin);
                
                // Lógica de colores para el Estado y la Caja Gigante
                let badgeColor = "bg-info text-dark";
                let iconEstado = "bi-info-circle";
                let colorCajaIzquierda = "bg-info text-white";
                
                const estadoLower = nombreEstado.toLowerCase();
                
                if(estadoLower.includes("pendiente") || estadoLower.includes("curso") || estadoLower.includes("proceso")) {
                    badgeColor = "bg-warning text-dark";
                    iconEstado = "bi-clock-history";
                    colorCajaIzquierda = "bg-warning text-dark"; // Amarillo es difícil de leer con texto blanco
                } else if(estadoLower.includes("resuelto") || estadoLower.includes("cerrado") || estadoLower.includes("fin")) {
                    badgeColor = "bg-success text-white";
                    iconEstado = "bi-check-circle";
                    colorCajaIzquierda = "bg-success text-white";
                }

                // Lógica de insignias para Compañeros
                let badgeCompaneros = "";
                if (tarea.usuario !== usuarioValidado && tarea.companeros && tarea.companeros.includes(usuarioValidado)) {
                    badgeCompaneros = `<span class="badge bg-secondary px-2 py-1"><i class="bi bi-people-fill"></i> Compartida contigo</span>`;
                } else if (tarea.usuario === usuarioValidado && tarea.companeros && tarea.companeros !== "") {
                    badgeCompaneros = `<span class="text-dark small border px-2 py-1 rounded bg-light"><i class="bi bi-people"></i> Trabajo en equipo</span>`;
                }

                // Ensamblamos el "Ticket"
                htmlLista += `
                    <div class="bg-white p-3 border rounded mb-3 shadow-sm d-flex align-items-md-center flex-column flex-md-row gap-3">
                        
                        <!-- Caja visual gigante a la izquierda (Estado) -->
                        <div class="${colorCajaIzquierda} rounded px-3 py-2 shadow-sm d-flex align-items-center justify-content-center" style="min-width: 70px; min-height: 70px;">
                            <i class="bi ${iconEstado} fs-2"></i>
                        </div>
                        
                        <!-- Contenido Central -->
                        <div class="flex-grow-1">
                            <div class="mb-1">
                                <span class="fw-bold text-dark fs-5 me-2">${nombreLugar}</span>
                                <span class="fst-italic text-secondary">${tarea.descripcion_corta}</span>
                            </div>
                            <div class="d-flex flex-wrap align-items-center gap-2 mt-2 mt-md-1">
                                <span class="badge ${badgeColor} px-2 py-1">${nombreEstado}</span>
                                <span class="badge bg-secondary px-2 py-1">${nombreTipo}</span>
                                <span class="text-dark small border px-2 py-1 rounded bg-light"><i class="bi bi-calendar-event text-muted"></i> ${fInicioCorta} - ${fFinCorta}</span>
                                ${badgeCompaneros}
                            </div>
                        </div>

                        <!-- Botones de Acción a la derecha -->
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

function prepararEdicion(idTarea, origen = 'list-section') {
    origenNavegacion = origen; // <--- AÑADE ESTA LÍNEA AQUÍ v17
    const tarea = datosApp.tareas.find(t => t.id === idTarea);
    if(!tarea) return;

    modoEdicionId = tarea.id;

    document.getElementById("lugar").tomselect.setValue(tarea.lugar);
    document.getElementById("tipo").value = tarea.tipo;
    document.getElementById("estado").value = tarea.estado;
    document.getElementById("descripcion_corta").value = tarea.descripcion_corta;
    
    // Uso de la función inteligente para asegurar que no se pierda la fecha
    document.getElementById("fecha_inicio").value = convertirAFechaInput(tarea.fecha_inicio);
    document.getElementById("fecha_fin").value = convertirAFechaInput(tarea.fecha_fin);

    let textoLimpio = tarea.parte;
    const regex = /^\[.*?\] - /;
    if(regex.test(textoLimpio)) {
        textoLimpio = textoLimpio.replace(regex, "");
    }
    document.getElementById("parte").value = textoLimpio; 
    //--> v14
    // Marcar los checks de los compañeros guardados
    document.querySelectorAll("#contenedorCompaneros input[type='checkbox']").forEach(chk => chk.checked = false);
    if (tarea.companeros) {
        const companerosArr = tarea.companeros.split(';');
        document.querySelectorAll("#contenedorCompaneros input[type='checkbox']").forEach(chk => {
            if (companerosArr.includes(chk.value)) chk.checked = true;
        });
    }
    //Manipular imagen para mostrar
    // Lógica de la mini-imagen con parche para URLs antiguas
    // Lógica de la mini-imagen (Extraemos el ID y usamos el visor de miniaturas de Google)
    if(tarea.imagen && tarea.imagen.includes("http")) {
        let urlGuardada = tarea.imagen;
        let idArchivo = "";

        // 1. Extraer el ID de la imagen sin importar el formato viejo o nuevo que tengamos guardado
        if (urlGuardada.includes("id=")) {
            idArchivo = urlGuardada.split("id=")[1].split("&")[0];
        } else if (urlGuardada.includes("/file/d/")) {
            idArchivo = urlGuardada.split("/file/d/")[1].split("/")[0];
        }

        if (idArchivo) {
            // 2. Generamos una URL especial para miniaturas que salta el bloqueo CORS (sz=w400 ajusta el ancho)
            let urlMiniatura = "https://drive.google.com/thumbnail?id=" + idArchivo + "&sz=w400";
            
            document.getElementById("contenedor_mini_imagen").style.display = "block";
            document.getElementById("mini_imagen_preview").src = urlMiniatura;
            
            // Mantenemos la URL original en el value oculto para no perder la máxima calidad al guardar
            document.getElementById("imagen_actual_url").value = urlGuardada; 
            document.getElementById("imagen").style.display = "none"; 
        } else {
            quitarImagenPrevia();
        }
    } else {
        quitarImagenPrevia();
    }

    // ========================================================
    // Lógica de la SEGUNDA mini-imagen (Posterior / Después)
    // ========================================================
    if(tarea.imagen2 && tarea.imagen2.includes("http")) {
        let urlGuardada2 = tarea.imagen2;
        let idArchivo2 = "";

        // 1. Extraer el ID de la imagen 2
        if (urlGuardada2.includes("id=")) {
            idArchivo2 = urlGuardada2.split("id=")[1].split("&")[0];
        } else if (urlGuardada2.includes("/file/d/")) {
            idArchivo2 = urlGuardada2.split("/file/d/")[1].split("/")[0];
        }

        if (idArchivo2) {
            // 2. Generamos miniatura
            let urlMiniatura2 = "https://drive.google.com/thumbnail?id=" + idArchivo2 + "&sz=w400";
            
            document.getElementById("contenedor_mini_imagen2").style.display = "block";
            document.getElementById("mini_imagen_preview2").src = urlMiniatura2;
            
            // Mantenemos URL original
            document.getElementById("imagen_actual_url2").value = urlGuardada2; 
            document.getElementById("imagen2").style.display = "none"; 
        } else {
            quitarImagenPrevia2();
        }
    } else {
        quitarImagenPrevia2();
    }

    // Cambiamos textos para modo edición
    document.querySelector("#form-section .card-title").innerText = "Modificar Parte";
    document.getElementById("btnEnviarParte").innerHTML = '<i class="bi bi-arrow-repeat"></i> Actualizar Parte';
    
    // 2. JUSTO AL FINAL DE LA FUNCIÓN (antes de navegarA), añade esto:
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

// Navegación inteligente al cancelar/terminar de editar
// --- NUEVAS FUNCIONES DE NAVEGACIÓN Y LIMPIEZA ---
function limpiarFormulario() {
    modoEdicionId = null; // Apagamos el modo edición
    
    document.getElementById("formularioTareas").reset();
    if(document.getElementById("lugar").tomselect) {
        document.getElementById("lugar").tomselect.clear();
    }
    configurarFechasPorDefecto();
    quitarImagenPrevia();
    
    // Restauramos los textos originales del formulario
    document.querySelector("#form-section .card-title").innerText = "Nuevo Parte de Trabajo";
    document.getElementById("btnEnviarParte").innerHTML = '<i class="bi bi-send-check"></i> Enviar Parte';
    
    const btn = document.getElementById("btnEnviarParte");
    btn.innerHTML = '<i class="bi bi-send-check"></i> Enviar Parte';
    btn.disabled = false; // <--- ESTO ARREGLA EL BLOQUEO
    
    const btnVolver = document.querySelector("#form-section .btn-outline-secondary");
        if(btnVolver) {
            btnVolver.innerHTML = '<i class="bi bi-arrow-left"></i> Volver al menú';
            btnVolver.setAttribute("onclick", "limpiarFormulario(); navegarA('menu-section')");
        }
}

function accionVolver() {
    if (modoEdicionId) {
        // Si estábamos modificando: Limpiamos, repintamos las tareas y vamos al listado
        limpiarFormulario();
        cargarListadoTareas(); 
        navegarA('list-section');
    } else {
        // Si estábamos creando un parte nuevo: Limpiamos y vamos al menú principal
        limpiarFormulario();
        navegarA('menu-section');
    }
}

function quitarImagenPrevia() {
    document.getElementById("contenedor_mini_imagen").style.display = "none";
    document.getElementById("imagen_actual_url").value = "";
    document.getElementById("mini_imagen_preview").src = "";
    document.getElementById("imagen").style.display = "block"; // Vuelve a mostrar el botón
    document.getElementById("imagen").value = "";
}

function quitarImagenPrevia2() {
    document.getElementById("contenedor_mini_imagen2").style.display = "none";
    document.getElementById("imagen_actual_url2").value = "";
    document.getElementById("mini_imagen_preview2").src = "";
    document.getElementById("imagen2").style.display = "block"; // Vuelve a mostrar el botón
    document.getElementById("imagen2").value = "";
}

function cancelarEdicionYVolver() {
    modoEdicionId = null;
    document.getElementById("formularioTareas").reset();
    document.getElementById("lugar").tomselect.clear();
    configurarFechasPorDefecto();
    quitarImagenPrevia();
    document.querySelector("#form-section .card-title").innerText = "Nuevo Parte de Trabajo";
    document.getElementById("btnEnviarParte").innerHTML = '<i class="bi bi-send-check"></i> Enviar Parte';
    navegarA('menu-section');
}

// --- 4. ENVÍO AL BACKEND (¡Único evento!) ---
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
    
    //--V26 ADMIN -> SELECTOR USUARIO <-- FORMULARIO ESTANDARD
    // Determinar usuario final y quién asigna
    let usuarioAsignado = usuarioValidado; // Por defecto, el idUsuario logueado
    let adminQueAsigna = ""; 

    if (rolValidado === 'admin') {
        let valorInput = document.getElementById("admin_tecnico_estandar").value;
        
        // Si el texto contiene el guion, extraemos la parte derecha (el email)
        if (valorInput.includes(" - ")) {
            usuarioAsignado = valorInput.split(" - ")[1].trim();
        } else {
            // Por si acaso el admin escribe el correo directamente a mano
            usuarioAsignado = valorInput.trim(); 
        }
        adminQueAsigna = usuarioValidado; // El correo del admin logueado
    }
    //--V26 ADMIN -> SELECTOR USUARIO <-- FORMULARIO ESTANDARD
 

    // 1. Preparamos el paquete BÁSICO (Las fotos nuevas van vacías de momento)
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
        //v26 MODIFICADOS USUARIO Y ASIGNADOPOR
        usuario: usuarioAsignado,
        asignadoPor: adminQueAsigna,
        equipo: equipoValidado,
        companeros: obtenerCompanerosSeleccionados(),
        
        //v27-->
        //¡AQUÍ ESTÁ LA CLAVE! 
        // Añadimos las variables del Admin vacías para que el backend no falle al buscarlas
        nota: "",
        idOrigen: "",
        etiquetas: "",
        fecha_solicitud: "",
        //<--

        // Datos para Foto 1 (Previa)
        imagenBase64: "",
        mimeType: "",
        nombreArchivo: "",
        imagen_actual_url: document.getElementById("imagen_actual_url").value, 
        
        // Datos para Foto 2 (Posterior)
        imagen2Base64: "",
        mimeType2: "",
        nombreArchivo2: "",
        imagen_actual_url2: document.getElementById("imagen_actual_url2").value
    };

    // 2. Preparamos el nombre base para los archivos
    const idLugarSelec = document.getElementById("lugar").value;
    const clienteObj = datosApp.clientes.find(c => c.id === idLugarSelec);
    const nombreLugar = clienteObj ? clienteObj.nombre : "Lugar";
    const lugarNormalizado = nombreLugar.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_");

    const inputImagen = document.getElementById("imagen");
    const inputImagen2 = document.getElementById("imagen2");

    // --- LÓGICA EN CASCADA PARA LEER FOTOS ---
    
    // Paso final: Enviar al servidor
    function enviarPeticionFinal() {
        enviarAlBackend(payload, btnEnviar);
    }

    // Paso 2: Procesar Foto 2
    function procesarImagen2() {
        if (inputImagen2 && inputImagen2.files.length > 0) {
            const archivo2 = inputImagen2.files[0];
            const reader2 = new FileReader();
            reader2.onload = function(evento2) {
                const nombreOriginalLimpio2 = archivo2.name.replace(/[^a-zA-Z0-9.]/g, "_").replace(/_+/g, "_");
                payload.imagen2Base64 = evento2.target.result.split(',')[1];
                payload.mimeType2 = archivo2.type;
                payload.nombreArchivo2 = lugarNormalizado + "_" + nombreOriginalLimpio2 + "_POST";
                enviarPeticionFinal(); // Todo leído, ¡A volar!
            };
            reader2.readAsDataURL(archivo2);
        } else {
            enviarPeticionFinal(); // No hay foto 2, enviamos ya.
        }
    }

    // Paso 1: Procesar Foto 1 (Aquí empieza el flujo)
    if (inputImagen && inputImagen.files.length > 0) {
        const archivo = inputImagen.files[0];
        const reader = new FileReader();
        reader.onload = function(evento) {
            const nombreOriginalLimpio = archivo.name.replace(/[^a-zA-Z0-9.]/g, "_").replace(/_+/g, "_");
            payload.imagenBase64 = evento.target.result.split(',')[1];
            payload.mimeType = archivo.type;
            payload.nombreArchivo = lugarNormalizado + "_" + nombreOriginalLimpio + "_PRE";
            procesarImagen2(); // Foto 1 lista, vamos a por la 2.
        };
        reader.readAsDataURL(archivo);
    } else {
        procesarImagen2(); // No hay foto 1, saltamos a revisar la 2.
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
            
            // Pedimos los datos frescos y ESPERAMOS a que lleguen (.then)
            cargarDatosDesdeAPI(false).then(() => {
                alert("✅ ¡Parte guardado correctamente!");
                
                // Limpiamos el formulario (sirve tanto para nuevos como para editados)
                limpiarFormulario();
                
                if (payload.modo === "editar") {
                    
                    // --- AQUÍ APLICAMOS LA MEMORIA INTELIGENTE ---
                    if (typeof origenNavegacion !== 'undefined' && origenNavegacion === 'informes-section') {
                        // Venimos de los informes: lo redibujamos y volvemos a él
                        generarInforme(); 
                        navegarA('informes-section');
                    } else {
                        // Venimos del listado normal: repintamos tarjetas y volvemos
                        cargarListadoTareas(); 
                        navegarA('list-section');
                    }
                    
                    // Reseteamos la memoria tras usarla
                    origenNavegacion = 'list-section';

                } else {
                    // Si era nuevo, volvemos al menú principal
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

// Eventos para búsqueda instantánea
document.getElementById("buscadorPartes").addEventListener("input", aplicarFiltrosPrincipales);
document.getElementById("filtroMes").addEventListener("change", aplicarFiltrosPrincipales);

// ==========================================
// MÓDULO DE INFORMES
// ==========================================

function generarInforme() {
    const fechaInicioVal = document.getElementById("informe_fecha_inicio").value;
    const fechaFinVal = document.getElementById("informe_fecha_fin").value;

    if (!fechaInicioVal) {
        alert("⚠️ Por favor, selecciona al menos una Fecha de Inicio.");
        return;
    }

    // Si no hay fecha fin, usamos la misma que la de inicio
    const dInicio = new Date(fechaInicioVal);
    const dFin = fechaFinVal ? new Date(fechaFinVal) : new Date(fechaInicioVal);

    let tareas = obtenerMisTareasBase();

    // Filtrar por fechas
    let tareasFiltradas = tareas.filter(t => {
        const fTareaStr = convertirAFechaInput(t.fecha_inicio);
        if (!fTareaStr) return false;
        const fTarea = new Date(fTareaStr);
        return fTarea >= dInicio && fTarea <= dFin;
    });

    // Ordenar cronológicamente
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

    // 1. LEEMOS LOS CHECKBOXES UNA SOLA VEZ AL PRINCIPIO
    // (Usamos un operador ternario por si acaso el HTML no cargó bien, por defecto en true)
    const verTipo = document.getElementById("chk_inf_tipo") ? document.getElementById("chk_inf_tipo").checked : true;
    const verFechas = document.getElementById("chk_inf_fechas") ? document.getElementById("chk_inf_fechas").checked : true;
    const verDias = document.getElementById("chk_inf_dias") ? document.getElementById("chk_inf_dias").checked : true;
    const verEquipo = document.getElementById("chk_inf_equipo") ? document.getElementById("chk_inf_equipo").checked : true;

    // 2. Agrupamos por meses
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

    // 3. Dibujamos el HTML
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

            // 4. APLICAMOS LA LÓGICA DE LOS CHECKBOXES AQUÍ
            let etiquetasHtml = "";
            if (verTipo) etiquetasHtml += `<span class="badge bg-secondary px-2 py-1">${nombreTipo}</span> `;
            if (verFechas) etiquetasHtml += `<span class="text-dark small border px-2 py-1 rounded bg-light"><i class="bi bi-calendar-event text-muted"></i> ${fIniCorta} - ${fFinCorta}</span> `;
            if (verDias) etiquetasHtml += `<span class="badge ${colorDias} px-2 py-1">${textoDias}</span> `;
            if (verEquipo) etiquetasHtml += `<span class="badge bg-dark px-2 py-1">${nombreEquipo}</span>`;

            // 5. Ensamblamos la fila --> antiguo
            /*html += `
                <div class="bg-white p-3 border rounded mb-3 shadow-sm d-flex align-items-md-center flex-column flex-md-row gap-3 html2pdf__page-break-avoid">
                    <div class="bg-primary text-white rounded px-3 py-2 fw-bold fs-4 shadow-sm text-center" style="min-width: 70px;">
                        #${contadorParte}
                    </div>
                    <div class="flex-grow-1">
                        <div class="mb-1">
                            <span class="fw-bold text-dark fs-5 me-2">${nombreLugar}</span>
                            <span class="fst-italic text-secondary">${tarea.descripcion_corta}</span>
                        </div>
                        <div class="d-flex flex-wrap align-items-center gap-2 mt-2 mt-md-1">
                            ${etiquetasHtml}
                        </div>
                    </div>
                </div>
            `;
            
            contadorParte++;*/
            // 5. Ensamblamos la fila
                html += `
                    <div class="bg-white p-3 border rounded mb-3 shadow-sm d-flex align-items-md-center flex-column flex-md-row gap-3 html2pdf__page-break-avoid">
                        <div class="bg-primary text-white rounded px-3 py-2 fw-bold fs-4 shadow-sm text-center" style="min-width: 70px;">
                            #${contadorParte}
                        </div>
                        <div class="flex-grow-1">
                            <div class="mb-1">
                                <span class="fw-bold text-dark fs-5 me-2">${nombreLugar}</span>
                                <span class="fst-italic text-secondary">${tarea.descripcion_corta}</span>
                            </div>
                            <div class="d-flex flex-wrap align-items-center gap-2 mt-2 mt-md-1">
                                ${etiquetasHtml}
                            </div>
                        </div>
                        
                        <!-- NUEVO BOTÓN: Solo visible en pantalla, invisible en el PDF -->
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

// Exportar la vista a un documento PDF real
function exportarPDF() {
    const elemento = document.getElementById("informeVisual");
    
    // Si está vacío (aparece el icono de la caja) no hacemos PDF
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
    
    // Cambiamos el texto del botón mientras carga
    const btn = document.getElementById("btnExportarPDF");
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="spinner-border spinner-border-sm"></i> Generando...';
    
    html2pdf().set(opciones).from(elemento).save().then(() => {
        btn.innerHTML = textoOriginal; // Restauramos el botón
    });
}

//--> v14
// ==========================================
// LÓGICA DEL FORMULARIO DE ASIGNACIÓN (ADMIN)
// ==========================================

//v25 v27

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


    // Cargar Selects normales (Tipo y Estado)
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
    
    cargarSelect("admin_tipo", datosApp.tipologias);
    cargarSelect("admin_estado", datosApp.estados);

    // Actuaciones Requeridas visualizadas como ETIQUETAS (Bootstrap Pills)
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

    // Compañeros (Inyectados todos, pero se deshabilitarán según el equipo)
    const contCompaneros = document.getElementById("admin_contenedorCompaneros");
    if (contCompaneros) {
        contCompaneros.innerHTML = '';
        let usuarios = datosApp.usuarios || [];
        usuarios.forEach((user, index) => {
            let nombreEq = user.extra || 'Sin equipo';
            let eqCorto = nombreEq !== 'Sin equipo' ? nombreEq.split('-')[0] : nombreEq;
            
            contCompaneros.innerHTML += `
                <div class="form-check border bg-white px-3 py-1 rounded shadow-sm contenedor-companero">
                    <!-- Añadimos data-id para guardar el email en secreto -->
                    <input class="form-check-input check-companero" type="checkbox" value="${user.nombre}" data-id="${user.id}" data-equipo="${nombreEq}" id="admin_comp_${index}">
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
        
        // Si no hay equipo seleccionado, cogemos el del Admin logueado por defecto
        if (!equipoSeleccionado && datosApp.usuarios) {
            let adminActual = datosApp.usuarios.find(u => u.id === usuarioValidado);
            equipoSeleccionado = adminActual ? adminActual.extra : "";
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
    aplicarFiltro(); // Ejecutar al inicio
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
        
        // Mantener texto manual
        let textoActual = inputDescripcion.value || "";
        let parteIzquierda = textoActual.split("|")[0]; 
        let textoManual = parteIzquierda;
        
        if (ultimoBloqueInicial && parteIzquierda.startsWith(ultimoBloqueInicial)) {
            textoManual = parteIzquierda.substring(ultimoBloqueInicial.length);
        } 
        
        textoManual = textoManual.trim();
        ultimoBloqueInicial = nuevoBloqueInicial;

        // Nuevas etiquetas con corchetes (Actuaciones)
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

//v25 v27



function abrirFormularioAdmin() {
    inicializarFormularioAdmin();
    // Limpiamos los campos por si venimos de hacer otro parte antes
    document.getElementById("formularioAdmin").reset();
    document.getElementById("admin_descripcion_corta").value = "";
    document.getElementById("admin_nota").value = "";
    
    // Ahora sí, abrimos la pantalla
    navegarA('admin-form-section');
}

//<--v14

/*Lógica antigua para enviar al backend el formulario admin
//-->V27 - Pruebas previas al envío al backend del formulario de admin -
document.getElementById("formularioAdmin").addEventListener("submit", function(e) {
    e.preventDefault();

    let nodosCompaneros = Array.from(document.querySelectorAll(".check-companero:checked"));
    if (nodosCompaneros.length === 0) {
        alert("Debes asignar al menos un compañero de equipo al parte.");
        return; 
    }

    // Recolectar nombres para la columna N (Compañeros)
    let stringCompaneros = nodosCompaneros.map(cb => cb.value).join(";");
    
    // Extraer el correo del primer compañero seleccionado para la columna K (Usuario)
    let usuarioAsignado = nodosCompaneros[0].getAttribute("data-id");

    let nombreUbicacion = document.getElementById("admin_ubicacion").value.trim();
    let idUbicacionFinal = nombreUbicacion; 
    if (datosApp.ubicaciones) {
        let ubicacionObj = datosApp.ubicaciones.find(u => u.nombre === nombreUbicacion);
        if (ubicacionObj) idUbicacionFinal = ubicacionObj.id; 
    }

    let etiquetasArray = Array.from(document.querySelectorAll(".check-actuacion:checked")).map(cb => cb.value);
    let stringEtiquetas = etiquetasArray.join(";");

    const payload = {
        modo: "crear",
        descripcion_corta: document.getElementById("admin_descripcion_corta").value,
        fecha_solicitud: document.getElementById("admin_fecha_solicitud").value,
        idOrigen: idUbicacionFinal, 
        etiquetas: stringEtiquetas, 
        companeros: stringCompaneros,
        usuario: usuarioAsignado,
        asignadoPor: usuarioValidado 
    };

    console.warn("📦 SIMULACIÓN LISTA:", payload);
    alert("Revisa la consola. Si el 'usuario' muestra el email y 'companeros' los nombres, ¡estamos listos!");
});
//<-- v27*/

//--> v27.3 lógica para enviar al backend del admin
document.getElementById("formularioAdmin").addEventListener("submit", async function(e) {
    e.preventDefault();

    let nodosCompaneros = Array.from(document.querySelectorAll(".check-companero:checked"));
    if (nodosCompaneros.length === 0) {
        alert("Debes asignar al menos un compañero de equipo al parte.");
        return; 
    }

    let stringCompaneros = nodosCompaneros.map(cb => cb.value).join(";");
    let usuarioAsignado = nodosCompaneros[0].getAttribute("data-id");

    let nombreUbicacion = document.getElementById("admin_ubicacion").value.trim();
    let idUbicacionFinal = nombreUbicacion; 
    if (datosApp.ubicaciones) {
        let ubicacionObj = datosApp.ubicaciones.find(u => u.nombre === nombreUbicacion);
        if (ubicacionObj) idUbicacionFinal = ubicacionObj.id; 
    }

    let etiquetasArray = Array.from(document.querySelectorAll(".check-actuacion:checked")).map(cb => cb.value);
    let stringEtiquetas = etiquetasArray.join(";");

    // Función auxiliar para leer imágenes a Base64 (heredada de tu lógica normal)
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

    // Leemos ambas fotos
    let img1 = await leerImagenBase64("admin_imagen");
    let img2 = await leerImagenBase64("admin_imagen2");

    // Mostramos estado de carga al usuario
    const btnSubmit = document.getElementById("btnEnviarAdmin");
    const textoOriginalBtn = btnSubmit.innerHTML;
    btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Guardando en base de datos...';
    btnSubmit.disabled = true;

    const payload = {
        modo: "crear", // Si luego haces el modo editar admin, lo cambias dinámicamente
        lugar: document.getElementById("admin_lugar").value,
        tipo: document.getElementById("admin_tipo").value,
        estado: document.getElementById("admin_estado").value,
        descripcion_corta: document.getElementById("admin_descripcion_corta").value,
        nota: document.getElementById("admin_nota").value,
        parte: document.getElementById("admin_parte").value,
        fecha_inicio: document.getElementById("admin_fecha_inicio").value,
        fecha_fin: document.getElementById("admin_fecha_fin").value,
        fecha_solicitud: document.getElementById("admin_fecha_solicitud").value, // Col T
        equipo: document.getElementById("admin_equipo").value, 
        usuario: usuarioAsignado,
        companeros: stringCompaneros,
        asignadoPor: usuarioValidado,
        idOrigen: idUbicacionFinal, // Col Q
        etiquetas: stringEtiquetas, // Col S
        
        // Imágenes
        imagenBase64: img1 ? img1.base64 : "",
        mimeType: img1 ? img1.mime : "",
        nombreArchivo: img1 ? img1.nombre : "",
        imagen2Base64: img2 ? img2.base64 : "",
        mimeType2: img2 ? img2.mime : "",
        nombreArchivo2: img2 ? img2.nombre : ""
    };

    //-> v27.3 comprobación por consola
    try {
            console.log("Enviando a la URL:", url); // Verifica si la URL existe y es correcta
            
            let respuesta = await fetch(url + "?t=" + new Date().getTime(), { 
                method: "POST",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8",
                },
                body: JSON.stringify(payload)
            });
            
            // 1. Primero leemos la respuesta como texto crudo para evitar que reviente
            let textoCrudo = await respuesta.text(); 
            
            // 2. Intentamos convertirlo a JSON
            let resultado;
            try {
                resultado = JSON.parse(textoCrudo);
            } catch (parseError) {
                console.error("❌ El servidor no devolvió JSON. Respuesta del servidor:", textoCrudo);
                alert("Error interno en el backend. Revisa la consola y las ejecuciones en Apps Script.");
                return; // Detenemos aquí
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
        } //<-- v27.3 
});
//<--v27.3 - modificado para enviar al backend, si algo falla revisar código