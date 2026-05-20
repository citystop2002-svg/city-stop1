firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

/* ELEMENTOS */

const loginBox =
document.getElementById("loginBox");

const adminPanel =
document.getElementById("adminPanel");

const productForm =
document.getElementById("productForm");

const productList =
document.getElementById("productList");

/* LOGIN */

document.getElementById("loginBtn")
.addEventListener("click", () => {

  const email =
  document.getElementById("email").value;

  const password =
  document.getElementById("password").value;

  auth.signInWithEmailAndPassword(email,password)

  .catch(error => {

    alert(error.message);

  });

});

/* LOGOUT */

document.getElementById("logoutBtn")
.addEventListener("click", () => {

  auth.signOut();

});

/* SESION */

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

document.getElementById("showFormBtn")
.addEventListener("click", () => {

  productForm.reset();

  document.getElementById("productId").value = "";

  if(productForm.style.display === "block"){

    productForm.style.display = "none";

  }else{

    productForm.style.display = "block";

  }

});

/* IMPORTAR PRODUCTOS */

document.getElementById("importBtn")
.addEventListener("click", async () => {

  const snapshot =
  await db.collection("productos").get();

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

productForm.addEventListener("submit",
async e => {

  e.preventDefault();

  const id =
  document.getElementById("productId").value;

  const codigo =
  document.getElementById("codigo")
  .value
  .toLowerCase();

  const producto = {

    codigo: codigo,

    nombre:
    document.getElementById("nombre").value,

    precio:
    document.getElementById("precio").value,

    marca:
    document.getElementById("marca").value,

    imagen:
    `img/${codigo}.png`,

    hover:
    `img/${codigo}-hover.png`,

    descripcion:
    document.getElementById("descripcion").value,

    stock:
    document.getElementById("stock").value

  };

  try{

    if(id){

      await db.collection("productos")
      .doc(id)
      .update(producto);

      alert("Producto actualizado 🚗");

    }else{

      await db.collection("productos")
      .add(producto);

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

    productList.innerHTML = "";

    snapshot.forEach(doc => {

      const p = doc.data();

      productList.innerHTML += `

      <div class="product-item">

        <div class="product-left">

          <img src="${p.imagen}">

          <div class="product-info">

            <strong>

              ${p.nombre}

            </strong>

            <span>

              💲 ${p.precio}

            </span>

            <span>

              📦 ${p.stock}

            </span>

          </div>

        </div>

        <div class="actions">

          <button
          onclick="editarProducto('${doc.id}')">

          Editar

          </button>

          <button
          class="delete-btn"
          onclick="eliminarProducto('${doc.id}')">

          Eliminar

          </button>

        </div>

      </div>

      `;

    });

  });

}

/* EDITAR */

async function editarProducto(id){

  const doc =
  await db.collection("productos")
  .doc(id)
  .get();

  if(!doc.exists){

    alert("Producto no encontrado");

    return;
  }

  const p = doc.data();

  productForm.style.display = "block";

  document.getElementById("productId").value = id;

  document.getElementById("codigo").value =
  p.codigo || "";

  document.getElementById("nombre").value =
  p.nombre || "";

  document.getElementById("precio").value =
  p.precio || "";

  document.getElementById("marca").value =
  p.marca || "";

  document.getElementById("descripcion").value =
  p.descripcion || "";

  document.getElementById("stock").value =
  p.stock || "Disponible";

  window.scrollTo({

    top:0,

    behavior:"smooth"

  });

}

/* ELIMINAR */

async function eliminarProducto(id){

  if(confirm("¿Eliminar producto?")){

    await db.collection("productos")
    .doc(id)
    .delete();

  }

}