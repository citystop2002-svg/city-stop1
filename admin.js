firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const localPersistence = firebase.auth.Auth && firebase.auth.Auth.Persistence
  ? firebase.auth.Auth.Persistence.LOCAL
  : null;
let authPersistenceReady = Promise.resolve();
if(localPersistence){
  authPersistenceReady = auth.setPersistence(localPersistence).catch(() => {});
}
const db = firebase.firestore();

const loginBox = document.getElementById("loginBox");
const adminPanel = document.getElementById("adminPanel");
const productForm = document.getElementById("productForm");
const productList = document.getElementById("productList");

const adminSearch = document.getElementById("adminSearch");
const brandFilter = document.getElementById("brandFilter");
const stockFilter = document.getElementById("stockFilter");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const adminCounter = document.getElementById("adminCounter");

const totalCount = document.getElementById("totalCount");
const availableCount = document.getElementById("availableCount");
const soldOutCount = document.getElementById("soldOutCount");
const lowCount = document.getElementById("lowCount");
const lastCount = document.getElementById("lastCount");

let productosAdmin = [];

/* LOGIN */

document.getElementById("loginBtn").addEventListener("click", async () => {

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  await authPersistenceReady;

  auth.signInWithEmailAndPassword(email, password)
    .catch(error => alert(error.message));

});

/* LOGOUT */

document.getElementById("logoutBtn").addEventListener("click", () => {
  auth.signOut();
});

/* SESIÓN */

auth.onAuthStateChanged(user => {

  if(user){
    loginBox.style.display = "none";
    adminPanel.style.display = "block";
    cargarProductos();
  }else{
    loginBox.style.display = "block";
    adminPanel.style.display = "none";
  }

});

/* MOSTRAR FORM */

document.getElementById("showFormBtn").addEventListener("click", () => {

  productForm.reset();
  document.getElementById("productId").value = "";

  productForm.style.display =
  productForm.style.display === "block" ? "none" : "block";

});

/* IMPORTAR */

document.getElementById("importBtn").addEventListener("click", async () => {

  const snapshot = await db.collection("productos").get();

  if(!snapshot.empty){
    alert("Ya existen productos");
    return;
  }

  for(const producto of productos){
    await db.collection("productos").add(producto);
  }

  alert("Productos importados 🚗🔥");

});

/* GUARDAR */

productForm.addEventListener("submit", async e => {

  e.preventDefault();

  const id = document.getElementById("productId").value;

  const codigo = document.getElementById("codigo").value.trim().toLowerCase();

  if(!codigo){
    alert("Escribe un código para el producto.");
    return;
  }

  try{
    const producto = {
      codigo: codigo,
      codigoReal: document.getElementById("codigoReal").value.trim(),
      nombre: document.getElementById("nombre").value.trim(),
      precio: document.getElementById("precio").value.trim(),
      marca: document.getElementById("marca").value.trim().toLowerCase(),
      imagen: `img/${codigo}.png`,
      hover: `img/${codigo}-hover.png`,
      descripcion: document.getElementById("descripcion").value.trim(),
      stock: document.getElementById("stock").value,
      lado: document.getElementById("lado").value,
      modelo: document.getElementById("modelo").value.trim(),
      tipo: document.getElementById("tipo").value,
      detalle: document.getElementById("detalle").value.trim(),
      cantidadIzquierdo: document.getElementById("cantidadIzquierdo").value || "0",
      cantidadDerecho: document.getElementById("cantidadDerecho").value || "0",
      precioCompra: document.getElementById("precioCompra").value || "0",
      precioVenta: document.getElementById("precioVenta").value || "0",
      descuento: document.getElementById("descuento").value.trim()
    };

    if(id){
      await db.collection("productos").doc(id).update(producto);
      alert("Producto actualizado 🚗");
    }else{
      await db.collection("productos").add(producto);
      alert("Producto agregado 🚗");
    }

    productForm.reset();
    document.getElementById("productId").value = "";
    productForm.style.display = "none";

  }catch(error){
    alert(error.message);
  }

});

/* CARGAR */

function cargarProductos(){

  db.collection("productos")
  .onSnapshot(snapshot => {

    productosAdmin = [];

    snapshot.forEach(doc => {
      productosAdmin.push({
        id: doc.id,
        ...doc.data()
      });
    });

    actualizarContadores();
    aplicarFiltrosAdmin();

  });

}

/* NORMALIZAR */

function normalizar(texto){
  return (texto || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/* CONTADORES */

function actualizarContadores(){

  totalCount.textContent = productosAdmin.length;

  availableCount.textContent = productosAdmin.filter(p =>
    normalizar(p.stock) === "disponible"
  ).length;

  soldOutCount.textContent = productosAdmin.filter(p =>
    normalizar(p.stock) === "agotado"
  ).length;

  lowCount.textContent = productosAdmin.filter(p =>
    normalizar(p.stock) === "pocas unidades"
  ).length;

  lastCount.textContent = productosAdmin.filter(p =>
    normalizar(p.stock) === "ultimas piezas"
  ).length;

}

/* FILTRAR */

function aplicarFiltrosAdmin(){

  const texto = normalizar(adminSearch.value);
  const marcaSeleccionada = normalizar(brandFilter.value);
  const estadoSeleccionado = normalizar(stockFilter.value);

  const filtrados = productosAdmin.filter(producto => {

    const nombre = normalizar(producto.nombre);
    const codigo = normalizar(producto.codigo);
    const codigoReal = normalizar(producto.codigoReal);
    const marca = normalizar(producto.marca);
    const descripcion = normalizar(producto.descripcion);
    const lado = normalizar(producto.lado);
    const modelo = normalizar(producto.modelo);
    const tipo = normalizar(producto.tipo);
    const detalle = normalizar(producto.detalle);
    const stock = normalizar(producto.stock);

    const coincideTexto =
      texto === "" ||
      nombre.includes(texto) ||
      codigo.includes(texto) ||
      codigoReal.includes(texto) ||
      marca.includes(texto) ||
      descripcion.includes(texto) ||
      lado.includes(texto) ||
      modelo.includes(texto) ||
      tipo.includes(texto) ||
      detalle.includes(texto);

    const coincideMarca =
      marcaSeleccionada === "todos" ||
      marca === marcaSeleccionada;

    const coincideEstado =
      estadoSeleccionado === "todos" ||
      stock === estadoSeleccionado;

    return coincideTexto && coincideMarca && coincideEstado;

  });

  mostrarProductosAdmin(filtrados);

}

/* MOSTRAR */

function mostrarProductosAdmin(lista){

  productList.innerHTML = "";

  adminCounter.textContent = `${lista.length} encontrados`;

  if(lista.length === 0){
    productList.innerHTML = `
      <p class="empty-message">
        No se encontraron productos.
      </p>
    `;
    return;
  }

  lista.forEach(p => {

    productList.innerHTML += `

      <div class="product-item">

        <div class="product-left">

          <img src="${p.imagen}" onerror="this.src='img/sin-imagen.png'">

          <div class="product-info">

            <strong>${p.nombre || "Sin nombre"}</strong>

            <span>💲 ${p.precio || "$0"}</span>

            <span>📦 ${p.stock || "Disponible"}</span>
            

            <small>Marca: ${p.marca || "sin marca"}</small>

            <small>Código producto: ${p.codigoReal || p.codigo || "sin código"}</small>
            <small>Compra: $${p.precioCompra || 0} | Venta: $${p.precioVenta || 0}</small>
            

          </div>

        </div>

        <div class="actions">

  <button onclick="editarProducto('${p.id}')">
    Editar
  </button>

  <button onclick="toggleVisible('${p.id}', ${p.visible === false})">
    ${
      p.visible === false
      ? "Subir al sitio"
      : "Remover del sitio"
    }
  </button>

  <button
  class="delete-btn"
  onclick="eliminarProducto('${p.id}')">
    Eliminar
  </button>

      </div>
      </div>

    `;

  });

}

/* EVENTOS FILTROS */

adminSearch.addEventListener("input", aplicarFiltrosAdmin);
brandFilter.addEventListener("change", aplicarFiltrosAdmin);
stockFilter.addEventListener("change", aplicarFiltrosAdmin);

clearFiltersBtn.addEventListener("click", () => {
  adminSearch.value = "";
  brandFilter.value = "todos";
  stockFilter.value = "todos";
  aplicarFiltrosAdmin();
});

/* EDITAR */

async function editarProducto(id){

  const doc = await db.collection("productos").doc(id).get();

  if(!doc.exists){
    alert("Producto no encontrado");
    return;
  }

  const p = doc.data();

  productForm.style.display = "block";

  document.getElementById("productId").value = id;
  document.getElementById("codigo").value = p.codigo || "";
  document.getElementById("codigoReal").value = p.codigoReal || "";
  document.getElementById("nombre").value = p.nombre || "";
  document.getElementById("precio").value = p.precio || "";
  document.getElementById("marca").value = p.marca || "";
  document.getElementById("lado").value = p.lado || "";
  document.getElementById("modelo").value = p.modelo || "";
  document.getElementById("tipo").value = p.tipo || "";
  document.getElementById("detalle").value = p.detalle || "";
  document.getElementById("descripcion").value = p.descripcion || "";
  document.getElementById("stock").value = p.stock || "Disponible";
  document.getElementById("cantidadIzquierdo").value = p.cantidadIzquierdo || "";
  document.getElementById("cantidadDerecho").value = p.cantidadDerecho || "";
  document.getElementById("precioCompra").value = p.precioCompra || "";
  document.getElementById("precioVenta").value = p.precioVenta || "";
  document.getElementById("descuento").value = p.descuento || "";
  

  window.scrollTo({
    top:0,
    behavior:"smooth"
  });

}

/* ELIMINAR */

async function eliminarProducto(id){

  if(confirm("¿Eliminar producto?")){
    await db.collection("productos").doc(id).delete();
  }

}
async function toggleVisible(id, visible){

  await db.collection("productos")
  .doc(id)
  .update({
    visible: visible
  });

}
