const express = require("express")
const router = express.Router()
const userController = require("../controllers/userController")
const { auth, checkRole } = require("../middleware/auth")

router.get("/", userController.getAllUsers)
router.get("/:id", auth, userController.getUserById)
router.put("/:id", auth, userController.updateUser)
router.delete("/:id", auth, userController.deleteUser)

router.get("/profile", auth, userController.getUserProfile)
router.put("/profile", auth, userController.updateUserProfile)
router.put("/change-password", auth, userController.changePassword)

module.exports = router
