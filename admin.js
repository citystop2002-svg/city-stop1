firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

const loginBox = document.getElementById("loginBox");
const adminPanel = document.getElementById("adminPanel");
const productForm = document.getElementById("productForm");
const productList = document.getElementById("productList");

const adminSearch = document.getElementById("adminSearch");
const brandFilter = document.getElementById("brandFilter");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const adminCounter = document.getElementById("adminCounter");

let productosAdmin = [];

/* LOGIN */

document.getElementById("loginBtn").addEventListener("click", () => {

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

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

/* MOSTRAR FORMULARIO */

document.getElementById("showFormBtn").addEventListener("click", () => {

  productForm.reset();
  document.getElementById("productId").value = "";

  if(productForm.style.display === "block"){
    productForm.style.display = "none";
  }else{
    productForm.style.display = "block";
  }

});

/* IMPORTAR PRODUCTOS ACTUALES */

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

/* GUARDAR PRODUCTO */

productForm.addEventListener("submit", async e => {

  e.preventDefault();

  const id = document.getElementById("productId").value;

  const codigo = document.getElementById("codigo").value.trim().toLowerCase();

  const producto = {
    codigo: codigo,
    nombre: document.getElementById("nombre").value.trim(),
    precio: document.getElementById("precio").value.trim(),
    marca: document.getElementById("marca").value.trim().toLowerCase(),
    imagen: `img/${codigo}.png`,
    hover: `img/${codigo}-hover.png`,
    descripcion: document.getElementById("descripcion").value.trim(),
    stock: document.getElementById("stock").value
  };

  try{

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

/* CARGAR PRODUCTOS */

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

    aplicarFiltrosAdmin();

  });

}

/* FILTROS ADMIN */

function aplicarFiltrosAdmin(){

  const texto = adminSearch.value.toLowerCase();
  const marcaSeleccionada = brandFilter.value.toLowerCase();

  const filtrados = productosAdmin.filter(producto => {

    const nombre = (producto.nombre || "").toLowerCase();
    const codigo = (producto.codigo || "").toLowerCase();
    const marca = (producto.marca || "").toLowerCase();

    const coincideTexto =
      nombre.includes(texto) ||
      codigo.includes(texto) ||
      marca.includes(texto);

    const coincideMarca =
      marcaSeleccionada === "todos" ||
      marca === marcaSeleccionada;

    return coincideTexto && coincideMarca;

  });

  mostrarProductosAdmin(filtrados);

}

/* MOSTRAR PRODUCTOS ADMIN */

function mostrarProductosAdmin(lista){

  productList.innerHTML = "";

  adminCounter.textContent = `Productos: ${lista.length}`;

  if(lista.length === 0){
    productList.innerHTML = `
      <p style="padding:20px; color:#777;">
        No se encontraron productos.
      </p>
    `;
    return;
  }

  lista.forEach(p => {

    productList.innerHTML += `

      <div class="product-item">

        <div class="product-left">

          <img src="${p.imagen}">

          <div class="product-info">

            <strong>${p.nombre || "Sin nombre"}</strong>

            <span>💲 ${p.precio || "$0"}</span>

            <span>📦 ${p.stock || "Disponible"}</span>

            <small>Marca: ${p.marca || "sin marca"}</small>

            <small>Código: ${p.codigo || "sin código"}</small>

          </div>

        </div>

        <div class="actions">

          <button onclick="editarProducto('${p.id}')">
            Editar
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

adminSearch.addEventListener("input", aplicarFiltrosAdmin);
brandFilter.addEventListener("change", aplicarFiltrosAdmin);

clearFiltersBtn.addEventListener("click", () => {
  adminSearch.value = "";
  brandFilter.value = "todos";
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
  document.getElementById("nombre").value = p.nombre || "";
  document.getElementById("precio").value = p.precio || "";
  document.getElementById("marca").value = p.marca || "";
  document.getElementById("descripcion").value = p.descripcion || "";
  document.getElementById("stock").value = p.stock || "Disponible";

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
