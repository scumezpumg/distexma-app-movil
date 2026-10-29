import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, Alert, Modal, TextInput, ScrollView, Image, Linking } from 'react-native';
import { useState, useEffect } from 'react';

// ============================================================
// CONFIGURACIÓN (cambia SOLO estas dos líneas)
// ============================================================
// URL del túnel (la misma que en main.js). Cámbiala cada vez que reinicies el túnel.
// Sin barra "/" al final.
const URL_BASE = 'https://0a8b7bcd5bffdb.lhr.life/distexma';

// Las imágenes se cargan desde Render para que no dependan del túnel
const URL_IMAGENES = 'https://distexma-web.onrender.com';

export default function HomeScreen() {
  const [inventarioOracle, setInventarioOracle] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Estados del flujo de la web
  const [paso, setPaso] = useState(1); // 1: Tipos, 2: Colores, 3: Tamaños y Stock
  const [tipoSeleccionado, setTipoSeleccionado] = useState('');
  const [coloresUnicos, setColoresUnicos] = useState([]);
  const [colorSeleccionado, setColorSeleccionado] = useState(null);
  const [productosTamanoActual, setProductosTamanoActual] = useState([]);
  const [tamanoSeleccionadoIndex, setTamanoSeleccionadoIndex] = useState(0);
  const [cantidadInput, setCantidadInput] = useState('1');

  // Estados del Buscador Rápido por Código (Ampliado a 10 resultados)
  const [busquedaCodigo, setBusquedaCodigo] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);

  // Carrito y Checkout
  const [carrito, setCarrito] = useState([]);
  const [modalCarritoVisible, setModalVisible] = useState(false);
  const [pasoCheckout, setPasoCheckout] = useState(false);

  // Campos del formulario de recogida y correo
  const [nombreCliente, setNombreCliente] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [correoCliente, setCorreoCliente] = useState('');
  const [fechaRecogida, setFechaRecogida] = useState('');
  const [guardandoPedido, setGuardandoPedido] = useState(false);

  // Cargar inventario completo desde api_catalogo.php
  useEffect(() => {
    fetch(`${URL_BASE}/api_catalogo.php`)
      .then(response => {
        if (!response.ok) throw new Error('Error al conectar con el servidor PHP');
        return response.json();
      })
      .then(data => {
        setInventarioOracle(data);
        setCargando(false);
      })
      .catch(err => {
        setError(err.message);
        setCargando(false);
      });
  }, []);

  // Mapeo exacto de las líneas en Oracle
  const NOMBRES_ORACLE = {
    'capuano': 'Capuano',
    'sedalina': 'Sedalina',
    'zim': 'Lana Zim'
  };

  // Función de Búsqueda Múltiple ampliada a 10 resultados
  const ejecutarBusquedaCodigo = (texto) => {
    setBusquedaCodigo(texto);
    const query = texto.trim().toUpperCase();

    if (!query) {
      setResultadosBusqueda([]);
      return;
    }

    const encontrados = inventarioOracle.filter(item => {
      const cod = item.codigo_interno || item.CODIGO_INTERNO;
      return cod && cod.toUpperCase().includes(query);
    });

    // Ampliamos a máximo 10 resultados con scroll interno controlado
    setResultadosBusqueda(encontrados.slice(0, 10));
  };

  // Seleccionar un producto directamente desde el resultado de la búsqueda
  const seleccionarProductoBusqueda = (item) => {
    const tipo = item.tipo_hilo || item.TIPO_HILO;
    const hex = item.codigo_hex || item.CODIGO_HEX;
    const colorNombre = item.color_nombre || item.COLOR_NOMBRE;

    setTipoSeleccionado(tipo);
    setColorSeleccionado({ hex, nombreColor: colorNombre });

    const filtrados = inventarioOracle.filter(inv =>
      (inv.tipo_hilo === tipo || inv.TIPO_HILO === tipo) &&
      (inv.codigo_hex === hex || inv.CODIGO_HEX === hex)
    );

    setProductosTamanoActual(filtrados);
    setTamanoSeleccionadoIndex(0);
    setCantidadInput('1');
    setBusquedaCodigo('');
    setResultadosBusqueda([]);
    setPaso(3);
  };

  // Abrir Tipo de Hilo (Paso 2)
  const abrirTipo = (idHtml) => {
    const nombreTipo = NOMBRES_ORACLE[idHtml];
    setTipoSeleccionado(nombreTipo);

    const hilos = inventarioOracle.filter(item =>
      (item.TIPO_HILO === nombreTipo || item.tipo_hilo === nombreTipo)
    );

    const coloresMap = [];
    const hexVistos = new Set();
    hilos.forEach(item => {
      const hex = item.CODIGO_HEX || item.codigo_hex;
      const nombreC = item.COLOR_NOMBRE || item.color_nombre;
      if (hex && !hexVistos.has(hex)) {
        hexVistos.add(hex);
        coloresMap.push({ codigo_hex: hex, color_nombre: nombreC });
      }
    });

    setColoresUnicos(coloresMap);
    setPaso(2);
  };

  // Seleccionar Color (Paso 3)
  const seleccionarColorMovil = (hex, nombreColor) => {
    setColorSeleccionado({ hex, nombreColor });

    const filtrados = inventarioOracle.filter(item =>
      (item.tipo_hilo === tipoSeleccionado || item.TIPO_HILO === tipoSeleccionado) &&
      (item.codigo_hex === hex || item.CODIGO_HEX === hex)
    );

    setProductosTamanoActual(filtrados);
    setTamanoSeleccionadoIndex(0);
    setCantidadInput('1');
    setPaso(3);
  };

  // Agregar al carrito con validación de stock
  const agregarAlCarritoMovil = () => {
    const p = productosTamanoActual[tamanoSeleccionadoIndex];
    if (!p) return;

    const codigo = p.codigo_interno || p.CODIGO_INTERNO;
    const precio = parseFloat(p.precio || p.PRECIO);
    const stock = parseInt(p.stock || p.STOCK);
    const tamano = p.tamano || p.TAMANO;
    const cant = parseInt(cantidadInput) || 1;

    if (cant <= 0 || cant > stock) {
      Alert.alert("Atención", `Cantidad inválida o stock insuficiente (Máx: ${stock})`);
      return;
    }

    const existente = carrito.find(item => item.codigo === codigo);
    if (existente) {
      if (existente.cantidad + cant <= stock) {
        existente.cantidad += cant;
      } else {
        Alert.alert("Stock máximo", `Ya tienes ${existente.cantidad} en el carrito y solo hay ${stock} disponibles.`);
        return;
      }
    } else {
      carrito.push({
        codigo,
        tipo: tipoSeleccionado,
        color: colorSeleccionado.nombreColor,
        tamano,
        precio,
        cantidad: cant,
        stockMax: stock
      });
    }

    setCarrito([...carrito]);
    Alert.alert("Éxito", "¡Producto agregado al carrito!");
    setPaso(1);
  };

  // Modificar cantidad directamente en el carrito (+ / -)
  const cambiarCantidadCarrito = (index, delta) => {
    const nuevoCarrito = [...carrito];
    const item = nuevoCarrito[index];
    const nuevaCant = item.cantidad + delta;

    if (nuevaCant <= 0) {
      nuevoCarrito.splice(index, 1);
    } else if (nuevaCant > item.stockMax) {
      Alert.alert("Stock máximo", `Solo hay ${item.stockMax} unidades disponibles.`);
      return;
    } else {
      item.cantidad = nuevaCant;
    }

    setCarrito(nuevoCarrito);
  };

  const calcularTotal = () => {
    return carrito.reduce((sum, item) => sum + (item.cantidad * item.precio), 0).toFixed(2);
  };

  // Enviar pedido a Oracle y WhatsApp
  const confirmarPedidoMovil = () => {
    if (!nombreCliente.trim() || !telefonoCliente.trim() || !correoCliente.trim() || !fechaRecogida.trim()) {
      Alert.alert("Error", "Debes completar el Nombre, Teléfono, Correo Electrónico y Fecha de Recogida.");
      return;
    }

    if (carrito.length === 0) return;

    setGuardandoPedido(true);

    const datosPedido = {
      nombre: nombreCliente.trim(),
      telefono: telefonoCliente.trim(),
      correo: correoCliente.trim(),
      fecha: fechaRecogida.trim(),
      carrito: carrito.map(item => ({
        codigo: item.codigo,
        precio: item.precio,
        cantidad: item.cantidad
      }))
    };

    fetch(`${URL_BASE}/guardar_pedido.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datosPedido)
    })
      .then(response => response.json())
      .then(data => {
        setGuardandoPedido(false);
        if (data.status === 'success') {
          const numeroOrden = data.numero_orden;

          // Actualizar stock visual al instante
          carrito.forEach(item => {
            const productoVisual = inventarioOracle.find(inv =>
              (inv.codigo_interno === item.codigo || inv.CODIGO_INTERNO === item.codigo)
            );
            if (productoVisual) {
              if (productoVisual.stock !== undefined) productoVisual.stock -= item.cantidad;
              if (productoVisual.STOCK !== undefined) productoVisual.STOCK -= item.cantidad;
            }
          });

          // Construir mensaje de WhatsApp
          let mensaje = `*NUEVA ORDEN DISTEXMA: ${numeroOrden}*\n\n`;
          mensaje += `*Nombre:* ${nombreCliente}\n`;
          mensaje += `*Teléfono:* ${telefonoCliente}\n`;
          mensaje += `*Correo:* ${correoCliente}\n`;
          mensaje += `*Fecha de recogida:* ${fechaRecogida}\n\n`;
          mensaje += `*DETALLE DEL PEDIDO:*\n`;

          let totalPedido = 0;
          carrito.forEach(item => {
            const subtotal = item.precio * item.cantidad;
            totalPedido += subtotal;
            mensaje += `- ${item.cantidad}x [${item.codigo}] ${item.color} (${item.tamano}) : Q${subtotal.toFixed(2)}\n`;
          });

          mensaje += `\n*TOTAL A PAGAR: Q${totalPedido.toFixed(2)}*`;

          const numeroWhatsApp = "50245947651";
          const urlWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`;

          Alert.alert("¡Reserva guardada!", `Orden: ${numeroOrden}. Redirigiendo a WhatsApp...`, [
            {
              text: "OK",
              onPress: () => {
                setCarrito([]);
                setPasoCheckout(false);
                setModalVisible(false);
                Linking.openURL(urlWhatsApp).catch(err =>
                  console.error("No se pudo abrir WhatsApp", err)
                );
              }
            }
          ]);
        } else {
          throw new Error(data.mensaje || 'Error desconocido al guardar');
        }
      })
      .catch(err => {
        setGuardandoPedido(false);
        Alert.alert("Error de guardado", err.message);
      });
  };

  if (cargando) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1557A6" />
        <Text style={styles.texto}>Cargando inventario de Oracle...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Error de conexión: {error}</Text>
        <Text style={styles.subError}>Verifica que el túnel esté activo, que la URL_BASE sea la actual y que XAMPP esté encendido.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>DISTEXMA</Text>
      <View style={styles.stepsBar}>
        <Text style={[styles.stepText, paso === 1 && styles.stepActive]}>1. Hilos</Text>
        <Text style={styles.stepDivider}> &gt; </Text>
        <Text style={[styles.stepText, paso === 2 && styles.stepActive]}>2. Colores</Text>
        <Text style={styles.stepDivider}> &gt; </Text>
        <Text style={[styles.stepText, paso === 3 && styles.stepActive]}>3. Presentación</Text>
      </View>

      {/* PASO 1: BÚSQUEDA MÚLTIPLE (MÁX 10) Y LÍNEAS DE HILOS */}
      {paso === 1 && (
        <ScrollView style={{flex: 1}} keyboardShouldPersistTaps="handled">
          <View style={styles.searchBoxContainer}>
            <Text style={styles.subtituloPaso}>🔍 Búsqueda rápida por Código:</Text>
            <TextInput
              style={styles.searchInputMovil}
              placeholder="Ej: 11 (muestra hasta 10 resultados)"
              value={busquedaCodigo}
              onChangeText={ejecutarBusquedaCodigo}
              autoCapitalize="characters"
            />
            {resultadosBusqueda.length > 0 && (
              <ScrollView style={styles.searchResultsContainer} nestedScrollEnabled={true}>
                {resultadosBusqueda.map((item, index) => {
                  const cod = item.codigo_interno || item.CODIGO_INTERNO;
                  const tipo = item.tipo_hilo || item.TIPO_HILO;
                  const colorN = item.color_nombre || item.COLOR_NOMBRE;
                  const hexC = item.codigo_hex || item.CODIGO_HEX;
                  const tamN = item.tamano || item.TAMANO;
                  const precioN = item.precio || item.PRECIO;
                  const stockN = item.stock || item.STOCK;

                  return (
                    <TouchableOpacity
                      key={index}
                      style={styles.searchResultItem}
                      onPress={() => seleccionarProductoBusqueda(item)}
                    >
                      <View style={[styles.colorCircleSmall, { backgroundColor: hexC }]} />
                      <View style={{flex: 1, marginLeft: 10}}>
                        <Text style={{fontWeight: 'bold', fontSize: 12, color: '#1557A6'}}>
                          {tipo} - {colorN} ({tamN})
                        </Text>
                        <Text style={{fontSize: 11, color: '#64748B'}}>
                          Cód: {cod} | Stock: {stockN} | Q{precioN}
                        </Text>
                      </View>
                      <Text style={{color: '#1557A6', fontWeight: 'bold', fontSize: 14}}>→</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>

          <Text style={styles.subtituloPaso}>Selecciona una línea de hilos:</Text>

          <TouchableOpacity style={styles.cardProducto} onPress={() => abrirTipo('capuano')}>
            <Image source={{ uri: `${URL_IMAGENES}/assets/img/capuano-1.jpeg` }} style={styles.cardImage} />
            <View style={{flex: 1}}>
              <Text style={styles.prodTitle}>Hilo Capuano</Text>
              <Text style={styles.prodDesc}>Tejeduría e industria - Varios colores</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cardProducto} onPress={() => abrirTipo('sedalina')}>
            <Image source={{ uri: `${URL_IMAGENES}/assets/img/estante6.jpeg` }} style={styles.cardImage} />
            <View style={{flex: 1}}>
              <Text style={styles.prodTitle}>Hilo Sedalina</Text>
              <Text style={styles.prodDesc}>Acabado fino y suave - Textura sedosa</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cardProducto} onPress={() => abrirTipo('zim')}>
            <Image source={{ uri: `${URL_IMAGENES}/assets/img/sedalina-1.jpeg` }} style={styles.cardImage} />
            <View style={{flex: 1}}>
              <Text style={styles.prodTitle}>Lana Zim</Text>
              <Text style={styles.prodDesc}>Alta resistencia - Costura continua</Text>
            </View>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* PASO 2: COLORES (GRILLA HEX) */}
      {paso === 2 && (
        <View style={{flex: 1}}>
          <TouchableOpacity onPress={() => setPaso(1)} style={styles.botonVolver}>
            <Text style={styles.textoVolver}>← Volver a líneas de hilos</Text>
          </TouchableOpacity>

          <Text style={styles.subtituloPaso}>Catálogo: {tipoSeleccionado}</Text>
          <Text style={styles.subHint}>Selecciona un color para ver precios y presentaciones:</Text>

          <FlatList
            data={coloresUnicos}
            keyExtractor={(item, index) => index.toString()}
            numColumns={4}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.colorItem}
                onPress={() => seleccionarColorMovil(item.codigo_hex, item.color_nombre)}
              >
                <View style={[styles.colorCircle, { backgroundColor: item.codigo_hex }]} />
                <Text style={styles.colorName} numberOfLines={2}>{item.color_nombre}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* PASO 3: TAMAÑO Y CANTIDAD */}
      {paso === 3 && (
        <ScrollView style={{flex: 1}}>
          <TouchableOpacity onPress={() => setPaso(1)} style={styles.botonVolver}>
            <Text style={styles.textoVolver}>← Volver al inicio</Text>
          </TouchableOpacity>

          <View style={styles.previewBox}>
            <View style={[styles.largeCircle, { backgroundColor: colorSeleccionado?.hex }]} />
            <View>
              <Text style={styles.previewTitle}>{colorSeleccionado?.nombreColor}</Text>
              <Text style={styles.previewSub}>{tipoSeleccionado}</Text>
            </View>
          </View>

          <Text style={styles.subtituloPaso}>Selecciona la presentación (Tamaño):</Text>
          <View style={styles.sizeContainer}>
            {productosTamanoActual.map((p, index) => {
              const tamanoNombre = p.tamano || p.TAMANO;
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.sizePill, tamanoSeleccionadoIndex === index && styles.sizePillActive]}
                  onPress={() => setTamanoSeleccionadoIndex(index)}
                >
                  <Text style={[styles.sizePillText, tamanoSeleccionadoIndex === index && styles.sizePillTextActive]}>
                    {tamanoNombre}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {productosTamanoActual[tamanoSeleccionadoIndex] && (
            <View style={styles.actionCard}>
              <View>
                <Text style={styles.precioText}>Q{productosTamanoActual[tamanoSeleccionadoIndex].precio || productosTamanoActual[tamanoSeleccionadoIndex].PRECIO}</Text>
                <Text style={styles.metaText}>Cód: {productosTamanoActual[tamanoSeleccionadoIndex].codigo_interno || productosTamanoActual[tamanoSeleccionadoIndex].CODIGO_INTERNO}</Text>
                <Text style={styles.metaText}>Disponibles: {productosTamanoActual[tamanoSeleccionadoIndex].stock || productosTamanoActual[tamanoSeleccionadoIndex].STOCK} conos</Text>
              </View>

              <View style={styles.controlsRow}>
                <TextInput
                  style={styles.qtyInput}
                  keyboardType="numeric"
                  value={cantidadInput}
                  onChangeText={setCantidadInput}
                />
                <TouchableOpacity style={styles.btnAddLarge} onPress={agregarAlCarritoMovil}>
                  <Text style={styles.btnAddText}>+ Agregar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* BOTÓN FLOTANTE DEL CARRITO */}
      <TouchableOpacity style={styles.footerContainer} onPress={() => setModalVisible(true)}>
        <View>
          <Text style={styles.textoCarrito}>Items: {carrito.reduce((sum, i) => sum + i.cantidad, 0)}</Text>
          <Text style={styles.textoTotal}>Total: Q{calcularTotal()}</Text>
        </View>
        <Text style={styles.textoVerCarrito}>Ver Carrito &gt;</Text>
      </TouchableOpacity>

      {/* MODAL DEL CARRITO Y CHECKOUT */}
      <Modal visible={modalCarritoVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitulo}>Tu Carrito de Compras</Text>

            {carrito.length === 0 ? (
              <Text style={styles.modalVacio}>El carrito está vacío.</Text>
            ) : (
              <ScrollView style={{maxHeight: 220}}>
                {carrito.map((item, index) => (
                  <View key={index} style={styles.modalItemCard}>
                    <View style={{flex: 1}}>
                      <Text style={styles.modalItemNombre}>{item.tipo} - {item.color} ({item.tamano})</Text>
                      <Text style={styles.modalItemDetalle}>Cód: {item.codigo} | Q{(item.precio * item.cantidad).toFixed(2)}</Text>
                    </View>

                    {/* CONTROLES DE CANTIDAD (+ / -) */}
                    <View style={styles.cartQtyControls}>
                      <TouchableOpacity style={styles.cartQtyBtn} onPress={() => cambiarCantidadCarrito(index, -1)}>
                        <Text style={styles.cartQtyBtnText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.cartQtyText}>{item.cantidad}</Text>
                      <TouchableOpacity style={styles.cartQtyBtn} onPress={() => cambiarCantidadCarrito(index, 1)}>
                        <Text style={styles.cartQtyBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            {carrito.length > 0 && (
              <View style={{marginTop: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 10}}>
                <Text style={{fontSize: 16, fontWeight: 'bold', color: '#1557A6', textAlign: 'right', marginBottom: 10}}>
                  Total: Q{calcularTotal()}
                </Text>

                {pasoCheckout && (
                  <View style={{backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0'}}>
                    <Text style={{fontSize: 14, fontWeight: 'bold', color: '#1557A6', marginBottom: 8}}>Datos de Recogida</Text>

                    <Text style={styles.labelForm}>Nombre completo</Text>
                    <TextInput style={styles.inputForm} placeholder="Tu nombre" value={nombreCliente} onChangeText={setNombreCliente} />

                    <Text style={styles.labelForm}>Teléfono</Text>
                    <TextInput style={styles.inputForm} placeholder="Ej: 55555555" keyboardType="phone-pad" value={telefonoCliente} onChangeText={setTelefonoCliente} />

                    <Text style={styles.labelForm}>Correo electrónico</Text>
                    <TextInput style={styles.inputForm} placeholder="ejemplo@correo.com" keyboardType="email-address" autoCapitalize="none" value={correoCliente} onChangeText={setCorreoCliente} />

                    <Text style={styles.labelForm}>Fecha de recogida (AAAA-MM-DD)</Text>
                    <TextInput style={styles.inputForm} placeholder="Ej: 2026-06-15" value={fechaRecogida} onChangeText={setFechaRecogida} />
                  </View>
                )}

                {!pasoCheckout ? (
                  <View style={{gap: 8}}>
                    <TouchableOpacity style={styles.btnPrimary} onPress={() => setPasoCheckout(true)}>
                      <Text style={styles.btnPrimaryText}>Finalizar Compra</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnSecondary} onPress={() => setModalVisible(false)}>
                      <Text style={styles.btnSecondaryText}>Continuar Comprando</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{gap: 8}}>
                    <TouchableOpacity style={[styles.btnPrimary, {backgroundColor: '#28a745'}]} onPress={confirmarPedidoMovil} disabled={guardandoPedido}>
                      <Text style={styles.btnPrimaryText}>{guardandoPedido ? "Guardando orden..." : "Confirmar Reserva (WhatsApp)"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.btnSecondary} onPress={() => setPasoCheckout(false)}>
                      <Text style={styles.btnSecondaryText}>← Volver al carrito</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {carrito.length === 0 && (
              <TouchableOpacity style={styles.botonCerrarModal} onPress={() => setModalVisible(false)}>
                <Text style={styles.textoCerrar}>Cerrar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F9FC', paddingTop: 40, paddingHorizontal: 15, paddingBottom: 15 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 20 },
  titulo: { fontSize: 24, fontWeight: '900', color: '#1557A6', textAlign: 'center', marginBottom: 5 },
  stepsBar: { flexDirection: 'row', justifyContent: 'center', marginBottom: 15, backgroundColor: '#E2E8F0', padding: 8, borderRadius: 8 },
  stepText: { fontSize: 12, color: '#64748B' },
  stepActive: { fontWeight: 'bold', color: '#1557A6' },
  stepDivider: { fontSize: 12, color: '#CBD5E1' },
  subtituloPaso: { fontSize: 15, fontWeight: '700', color: '#172033', marginBottom: 10 },
  subHint: { fontSize: 13, color: '#64748B', marginBottom: 15 },
  searchBoxContainer: { backgroundColor: 'white', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 15 },
  searchInputMovil: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 8, fontSize: 13, backgroundColor: '#F8FAFC', color: '#172033', marginTop: 5 },
  searchResultsContainer: { marginTop: 8, maxHeight: 220, backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1' },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  colorCircleSmall: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: '#ddd' },
  cardProducto: { backgroundColor: 'white', borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, elevation: 2 },
  cardImage: { width: 90, height: 90, resizeMode: 'cover' },
  prodTitle: { fontSize: 16, fontWeight: '800', color: '#1557A6', marginLeft: 15 },
  prodDesc: { fontSize: 12, color: '#64748B', marginLeft: 15, marginTop: 2 },
  colorItem: { flex: 1, alignItems: 'center', margin: 6, padding: 8, backgroundColor: 'white', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', maxWidth: '22%' },
  colorCircle: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#fff', marginBottom: 5 },
  colorName: { fontSize: 10, fontWeight: '700', color: '#172033', textAlign: 'center' },
  botonVolver: { marginBottom: 15 },
  textoVolver: { color: '#1557A6', fontWeight: 'bold', fontSize: 14 },
  previewBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 15, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20, gap: 15 },
  largeCircle: { width: 60, height: 60, borderRadius: 30, borderWidth: 3, borderColor: '#fff' },
  previewTitle: { fontSize: 16, fontWeight: 'bold', color: '#1557A6' },
  previewSub: { fontSize: 13, color: '#64748B' },
  sizeContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  sizePill: { flex: 1, padding: 12, backgroundColor: 'white', borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 10, alignItems: 'center' },
  sizePillActive: { borderColor: '#1557A6', backgroundColor: '#1557A6' },
  sizePillText: { fontWeight: '700', color: '#64748B', fontSize: 13 },
  sizePillTextActive: { color: 'white' },
  actionCard: { backgroundColor: 'white', padding: 20, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  precioText: { fontSize: 22, fontWeight: '900', color: '#D62828' },
  metaText: { fontSize: 12, color: '#64748B', marginTop: 2 },
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyInput: { width: 50, height: 42, borderWidth: 2, borderColor: '#E2E8F0', borderRadius: 8, textAlign: 'center', fontSize: 16, fontWeight: 'bold', color: '#1557A6' },
  btnAddLarge: { backgroundColor: '#F4C300', paddingHorizontal: 15, height: 42, justifyContent: 'center', borderRadius: 8 },
  btnAddText: { fontWeight: '800', color: '#081B33' },
  footerContainer: { backgroundColor: '#1557A6', padding: 15, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  textoCarrito: { color: 'white', fontSize: 12 },
  textoTotal: { color: 'white', fontSize: 15, fontWeight: 'bold' },
  textoVerCarrito: { color: '#F4C300', fontWeight: 'bold', fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '88%' },
  modalTitulo: { fontSize: 18, fontWeight: 'bold', color: '#1557A6', marginBottom: 15, textAlign: 'center' },
  modalVacio: { textAlign: 'center', color: '#64748B', marginVertical: 20 },
  modalItemCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalItemNombre: { fontSize: 12, fontWeight: 'bold', color: '#172033' },
  modalItemDetalle: { fontSize: 11, color: '#64748B' },
  cartQtyControls: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6 },
  cartQtyBtn: { width: 24, height: 24, backgroundColor: '#1557A6', borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  cartQtyBtnText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  cartQtyText: { fontSize: 13, fontWeight: 'bold', color: '#172033', minWidth: 16, textAlign: 'center' },
  labelForm: { fontSize: 11, fontWeight: 'bold', color: '#475569', marginTop: 4, marginBottom: 2 },
  inputForm: { backgroundColor: 'white', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6, padding: 6, fontSize: 12, color: '#172033' },
  btnPrimary: { backgroundColor: '#1557A6', padding: 12, borderRadius: 8, alignItems: 'center' },
  btnPrimaryText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  btnSecondary: { backgroundColor: '#E2E8F0', padding: 10, borderRadius: 8, alignItems: 'center' },
  btnSecondaryText: { color: '#334155', fontWeight: 'bold', fontSize: 13 },
  botonCerrarModal: { backgroundColor: '#64748B', paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  textoCerrar: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  texto: { marginTop: 10, color: '#64748B' },
  errorText: { fontSize: 16, color: '#D62828', fontWeight: 'bold', textAlign: 'center' },
  subError: { fontSize: 14, color: '#64748B', marginTop: 5, textAlign: 'center' }
});