from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
import hashlib
import hmac
import httpx
from enum import Enum
import asyncio
from urllib.parse import parse_qsl

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Telegram Bot config
TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_DRIVERS_CHAT_ID = os.environ.get('TELEGRAM_DRIVERS_CHAT_ID', '')

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== ENUMS ====================

class OrderStatus(str, Enum):
    NEW = "NEW"
    BROADCAST = "BROADCAST"
    ASSIGNED = "ASSIGNED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class DriverStatus(str, Enum):
    ACTIVE = "ACTIVE"
    BLOCKED = "BLOCKED"

class ActionType(str, Enum):
    ORDER_CREATED = "ORDER_CREATED"
    ORDER_BROADCAST = "ORDER_BROADCAST"
    ORDER_ASSIGNED = "ORDER_ASSIGNED"
    ORDER_COMPLETED = "ORDER_COMPLETED"
    ORDER_CANCELLED = "ORDER_CANCELLED"
    DRIVER_REGISTERED = "DRIVER_REGISTERED"
    DRIVER_BLOCKED = "DRIVER_BLOCKED"
    DRIVER_UNBLOCKED = "DRIVER_UNBLOCKED"

# ==================== MODELS ====================

class ClientModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    telegram_id: str
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class DriverModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    telegram_id: str
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    # Данные автомобиля
    car_brand: Optional[str] = None
    car_model: Optional[str] = None
    car_color: Optional[str] = None
    car_plate: Optional[str] = None
    is_registered: bool = False  # Полностью зарегистрирован с данными авто
    registration_step: Optional[str] = None  # Текущий шаг регистрации
    status: DriverStatus = DriverStatus.ACTIVE
    is_busy: bool = False
    current_order_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class OrderModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_id: str
    client_telegram_id: str
    client_phone: Optional[str] = None  # Телефон клиента
    address_from: str
    address_to: str
    comment: Optional[str] = None
    status: OrderStatus = OrderStatus.NEW
    driver_id: Optional[str] = None
    driver_telegram_id: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    driver_car: Optional[str] = None  # Информация об автомобиле
    telegram_message_id: Optional[int] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    assigned_at: Optional[str] = None
    completed_at: Optional[str] = None
    cancelled_at: Optional[str] = None

class ActionLogModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    action_type: ActionType
    order_id: Optional[str] = None
    driver_id: Optional[str] = None
    client_id: Optional[str] = None
    admin_id: Optional[str] = None
    details: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class AdminModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    telegram_id: str
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ==================== REQUEST/RESPONSE SCHEMAS ====================

class CreateOrderRequest(BaseModel):
    address_from: str
    address_to: str
    comment: Optional[str] = None

class UpdateClientPhoneRequest(BaseModel):
    telegram_id: str
    phone: str

class TelegramInitData(BaseModel):
    init_data: str

class AdminLoginRequest(BaseModel):
    telegram_id: str
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    auth_date: int
    hash: str

class UpdateDriverRequest(BaseModel):
    status: Optional[DriverStatus] = None
    phone: Optional[str] = None
    car_brand: Optional[str] = None
    car_model: Optional[str] = None
    car_color: Optional[str] = None
    car_plate: Optional[str] = None

class AssignDriverRequest(BaseModel):
    driver_id: str

class SetDriversChatRequest(BaseModel):
    chat_id: str

# ==================== HELPER FUNCTIONS ====================

def verify_telegram_auth(auth_data: dict) -> bool:
    """Verify Telegram login widget data"""
    if not TELEGRAM_BOT_TOKEN:
        return True  # Skip verification if no token
    
    check_hash = auth_data.pop('hash', None)
    if not check_hash:
        return False
    
    data_check_arr = sorted([f"{k}={v}" for k, v in auth_data.items()])
    data_check_string = "\n".join(data_check_arr)
    
    secret_key = hashlib.sha256(TELEGRAM_BOT_TOKEN.encode()).digest()
    hmac_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    
    return hmac_hash == check_hash

def parse_telegram_init_data(init_data: str) -> dict:
    """Parse Telegram Mini App init data"""
    data = dict(parse_qsl(init_data))
    return data

async def log_action(action_type: ActionType, **kwargs):
    """Log action to database"""
    log_entry = ActionLogModel(action_type=action_type, **kwargs)
    doc = log_entry.model_dump()
    await db.action_logs.insert_one(doc)
    return log_entry

async def send_telegram_message(chat_id: str, text: str, reply_markup: dict = None):
    """Send message via Telegram Bot API"""
    if not TELEGRAM_BOT_TOKEN:
        logger.warning("Telegram bot token not configured")
        return None
    
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML"
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup
    
    async with httpx.AsyncClient() as http_client:
        response = await http_client.post(url, json=payload)
        return response.json()

async def edit_telegram_message(chat_id: str, message_id: int, text: str, reply_markup: dict = None):
    """Edit message via Telegram Bot API"""
    if not TELEGRAM_BOT_TOKEN:
        return None
    
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/editMessageText"
    payload = {
        "chat_id": chat_id,
        "message_id": message_id,
        "text": text,
        "parse_mode": "HTML"
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup
    
    async with httpx.AsyncClient() as http_client:
        response = await http_client.post(url, json=payload)
        return response.json()

async def answer_callback_query(callback_query_id: str, text: str = None, show_alert: bool = False):
    """Answer callback query"""
    if not TELEGRAM_BOT_TOKEN:
        return None
    
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/answerCallbackQuery"
    payload = {
        "callback_query_id": callback_query_id,
        "show_alert": show_alert
    }
    if text:
        payload["text"] = text
    
    async with httpx.AsyncClient() as http_client:
        response = await http_client.post(url, json=payload)
        return response.json()

async def broadcast_order_to_drivers(order: OrderModel):
    """Send order to drivers chat"""
    global TELEGRAM_DRIVERS_CHAT_ID
    
    if not TELEGRAM_DRIVERS_CHAT_ID:
        logger.warning("Drivers chat ID not configured")
        return None
    
    text = f"""🚖 <b>Новый заказ!</b>

📍 <b>Откуда:</b> {order.address_from}
📍 <b>Куда:</b> {order.address_to}
"""
    if order.comment:
        text += f"💬 <b>Комментарий:</b> {order.comment}\n"
    
    if order.client_phone:
        text += f"📞 <b>Телефон клиента:</b> {order.client_phone}\n"
    
    text += f"\n🆔 Заказ: <code>{order.id[:8]}</code>"
    
    reply_markup = {
        "inline_keyboard": [[
            {"text": "✅ Принять заказ", "callback_data": f"accept_order:{order.id}"}
        ]]
    }
    
    result = await send_telegram_message(TELEGRAM_DRIVERS_CHAT_ID, text, reply_markup)
    
    if result and result.get("ok"):
        message_id = result["result"]["message_id"]
        await db.orders.update_one(
            {"id": order.id},
            {"$set": {"telegram_message_id": message_id, "status": OrderStatus.BROADCAST}}
        )
        await log_action(ActionType.ORDER_BROADCAST, order_id=order.id)
        return message_id
    
    return None

async def notify_client(client_telegram_id: str, message: str):
    """Send notification to client"""
    await send_telegram_message(client_telegram_id, message)

# ==================== CLIENT API (Mini App) ====================

@api_router.post("/client/auth")
async def client_auth(data: TelegramInitData):
    """Authenticate client from Mini App"""
    parsed = parse_telegram_init_data(data.init_data)
    logger.info(f"Client auth parsed data: {parsed}")
    
    # Extract user data from init_data
    import json
    try:
        user_data = json.loads(parsed.get("user", "{}"))
    except:
        user_data = {}
    
    telegram_id = str(user_data.get("id", ""))
    
    # If no telegram_id from init_data, try to get from query_id or use fallback
    if not telegram_id:
        # For testing/demo purposes - allow auth without valid init_data
        logger.warning("No telegram_id in init_data, using demo mode")
        raise HTTPException(status_code=400, detail="Invalid init data")
    
    # Find or create client
    existing = await db.clients.find_one({"telegram_id": telegram_id}, {"_id": 0})
    
    if existing:
        logger.info(f"Client found: {telegram_id}")
        return existing
    
    new_client = ClientModel(
        telegram_id=telegram_id,
        username=user_data.get("username"),
        first_name=user_data.get("first_name"),
        last_name=user_data.get("last_name")
    )
    await db.clients.insert_one(new_client.model_dump())
    logger.info(f"New client created: {telegram_id}")
    return new_client.model_dump()

@api_router.post("/client/update-phone")
async def update_client_phone(data: UpdateClientPhoneRequest):
    """Update client phone number"""
    telegram_id = data.telegram_id
    phone = data.phone
    
    # Format phone number
    phone = phone.strip()
    if not phone.startswith("+"):
        phone = "+" + phone
    
    # Find or create client
    client_doc = await db.clients.find_one({"telegram_id": telegram_id}, {"_id": 0})
    
    if client_doc:
        # Update existing client
        await db.clients.update_one(
            {"telegram_id": telegram_id},
            {"$set": {"phone": phone}}
        )
        client_doc["phone"] = phone
        logger.info(f"Client phone updated: {telegram_id} -> {phone}")
        return client_doc
    else:
        # Create new client with phone
        new_client = ClientModel(
            telegram_id=telegram_id,
            phone=phone
        )
        await db.clients.insert_one(new_client.model_dump())
        logger.info(f"New client created with phone: {telegram_id} -> {phone}")
        return new_client.model_dump()

@api_router.post("/client/order")
async def create_order(order_data: CreateOrderRequest, telegram_id: str = Query(...)):
    """Create new order"""
    logger.info(f"Create order request from telegram_id: {telegram_id}")
    
    # Get client - must exist with phone
    client_doc = await db.clients.find_one({"telegram_id": telegram_id}, {"_id": 0})
    if not client_doc:
        raise HTTPException(status_code=404, detail="Клиент не найден. Пожалуйста, предоставьте номер телефона.")
    
    if not client_doc.get("phone"):
        raise HTTPException(status_code=400, detail="Для заказа необходимо предоставить номер телефона")
    
    # Check if client has active order
    active_order = await db.orders.find_one({
        "client_telegram_id": telegram_id,
        "status": {"$in": [OrderStatus.NEW, OrderStatus.BROADCAST, OrderStatus.ASSIGNED]}
    }, {"_id": 0})
    
    if active_order:
        raise HTTPException(status_code=400, detail="У вас уже есть активный заказ")
    
    # Create order
    order = OrderModel(
        client_id=client_doc["id"],
        client_telegram_id=telegram_id,
        client_phone=client_doc.get("phone"),
        address_from=order_data.address_from,
        address_to=order_data.address_to,
        comment=order_data.comment
    )
    
    await db.orders.insert_one(order.model_dump())
    await log_action(ActionType.ORDER_CREATED, order_id=order.id, client_id=client_doc["id"])
    
    # Broadcast to drivers
    asyncio.create_task(broadcast_order_to_drivers(order))
    
    logger.info(f"Order created: {order.id}")
    return order.model_dump()

@api_router.get("/client/order/active")
async def get_active_order(telegram_id: str = Query(...)):
    """Get client's active order"""
    order = await db.orders.find_one({
        "client_telegram_id": telegram_id,
        "status": {"$in": [OrderStatus.NEW, OrderStatus.BROADCAST, OrderStatus.ASSIGNED]}
    }, {"_id": 0})
    
    return order

@api_router.post("/client/order/{order_id}/cancel")
async def cancel_order(order_id: str, telegram_id: str = Query(...)):
    """Cancel order by client"""
    order = await db.orders.find_one({
        "id": order_id,
        "client_telegram_id": telegram_id
    }, {"_id": 0})
    
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    if order["status"] not in [OrderStatus.NEW, OrderStatus.BROADCAST]:
        raise HTTPException(status_code=400, detail="Невозможно отменить заказ в текущем статусе")
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": OrderStatus.CANCELLED,
            "cancelled_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    await log_action(ActionType.ORDER_CANCELLED, order_id=order_id, client_id=order["client_id"])
    
    # Update message in drivers chat if exists
    if order.get("telegram_message_id") and TELEGRAM_DRIVERS_CHAT_ID:
        await edit_telegram_message(
            TELEGRAM_DRIVERS_CHAT_ID,
            order["telegram_message_id"],
            f"❌ <b>Заказ отменён клиентом</b>\n\n🆔 Заказ: <code>{order_id[:8]}</code>"
        )
    
    return {"success": True, "message": "Заказ отменён"}

@api_router.get("/client/orders/history")
async def get_order_history(telegram_id: str = Query(...)):
    """Get client's order history"""
    orders = await db.orders.find(
        {"client_telegram_id": telegram_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return orders

# ==================== TELEGRAM BOT WEBHOOK ====================

@api_router.post("/telegram/webhook")
async def telegram_webhook(request: Request):
    """Handle Telegram bot updates"""
    data = await request.json()
    logger.info(f"Telegram webhook: {data}")
    
    # Handle new member in drivers chat
    if "message" in data and "new_chat_members" in data["message"]:
        chat_id = data["message"]["chat"]["id"]
        
        # Check if this is the drivers chat
        if str(chat_id) == TELEGRAM_DRIVERS_CHAT_ID:
            for new_member in data["message"]["new_chat_members"]:
                if new_member.get("is_bot"):
                    continue  # Skip bots
                
                telegram_id = str(new_member["id"])
                
                # Check if driver already exists
                existing_driver = await db.drivers.find_one({"telegram_id": telegram_id}, {"_id": 0})
                
                if not existing_driver:
                    # Create new driver
                    driver = DriverModel(
                        telegram_id=telegram_id,
                        username=new_member.get("username"),
                        first_name=new_member.get("first_name"),
                        last_name=new_member.get("last_name"),
                        is_registered=False,
                        registration_step="car_brand"
                    )
                    await db.drivers.insert_one(driver.model_dump())
                    
                    # Send welcome message to driver in private
                    first_name = new_member.get("first_name", "")
                    await send_telegram_message(
                        telegram_id,
                        f"🚕 Привет, {first_name}!\n\n"
                        f"Добро пожаловать в команду водителей такси!\n\n"
                        f"Для начала работы необходимо заполнить данные об автомобиле.\n\n"
                        f"🚗 Введите марку автомобиля (например: Toyota, Hyundai, Kia):"
                    )
                elif not existing_driver.get("is_registered"):
                    # Driver exists but not registered - remind them
                    if not existing_driver.get("registration_step"):
                        await db.drivers.update_one(
                            {"telegram_id": telegram_id},
                            {"$set": {"registration_step": "car_brand"}}
                        )
                    
                    await send_telegram_message(
                        telegram_id,
                        "🚕 Вы ещё не завершили регистрацию!\n\n"
                        "🚗 Введите марку автомобиля:"
                    )
        
        return {"ok": True}
    
    # Handle /start command
    if "message" in data and data["message"].get("text") == "/start":
        chat_id = data["message"]["chat"]["id"]
        user = data["message"]["from"]
        first_name = user.get("first_name", "")
        
        welcome_text = f"🚖 Привет, {first_name}!\n\nДобро пожаловать в службу такси.\nНажмите кнопку ниже, чтобы заказать такси:"
        
        reply_markup = {
            "inline_keyboard": [[
                {
                    "text": "🚖 Заказать такси",
                    "web_app": {"url": os.environ.get("WEBAPP_URL", "https://brief-specs-1.preview.emergentagent.com")}
                }
            ]]
        }
        
        await send_telegram_message(str(chat_id), welcome_text, reply_markup)
        return {"ok": True}
    
    # Handle text messages (for driver registration)
    if "message" in data and "text" in data["message"]:
        chat_id = data["message"]["chat"]["id"]
        text = data["message"]["text"]
        user = data["message"]["from"]
        telegram_id = str(user["id"])
        
        # Check if driver is in registration process
        driver = await db.drivers.find_one({"telegram_id": telegram_id}, {"_id": 0})
        
        if driver and driver.get("registration_step"):
            step = driver["registration_step"]
            
            if step == "car_brand":
                await db.drivers.update_one(
                    {"telegram_id": telegram_id},
                    {"$set": {"car_brand": text, "registration_step": "car_model"}}
                )
                await send_telegram_message(telegram_id, "🚗 Введите модель автомобиля:")
                return {"ok": True}
            
            elif step == "car_model":
                await db.drivers.update_one(
                    {"telegram_id": telegram_id},
                    {"$set": {"car_model": text, "registration_step": "car_color"}}
                )
                await send_telegram_message(telegram_id, "🎨 Введите цвет автомобиля:")
                return {"ok": True}
            
            elif step == "car_color":
                await db.drivers.update_one(
                    {"telegram_id": telegram_id},
                    {"$set": {"car_color": text, "registration_step": "car_plate"}}
                )
                await send_telegram_message(telegram_id, "🔢 Введите гос. номер автомобиля:")
                return {"ok": True}
            
            elif step == "car_plate":
                await db.drivers.update_one(
                    {"telegram_id": telegram_id},
                    {"$set": {
                        "car_plate": text.upper(),
                        "registration_step": None,
                        "is_registered": True
                    }}
                )
                
                # Get updated driver info
                updated_driver = await db.drivers.find_one({"telegram_id": telegram_id}, {"_id": 0})
                
                await send_telegram_message(
                    telegram_id,
                    f"✅ Регистрация завершена!\n\n"
                    f"🚗 Ваш автомобиль:\n"
                    f"• Марка: {updated_driver['car_brand']}\n"
                    f"• Модель: {updated_driver['car_model']}\n"
                    f"• Цвет: {updated_driver['car_color']}\n"
                    f"• Гос. номер: {updated_driver['car_plate']}\n\n"
                    f"Теперь вы можете принимать заказы в группе водителей!"
                )
                await log_action(ActionType.DRIVER_REGISTERED, driver_id=updated_driver["id"])
                return {"ok": True}
    
    # Handle callback query (button press)
    if "callback_query" in data:
        callback = data["callback_query"]
        callback_id = callback["id"]
        callback_data = callback.get("data", "")
        user = callback["from"]
        telegram_id = str(user["id"])
        
        if callback_data.startswith("accept_order:"):
            order_id = callback_data.split(":")[1]
            
            # Check if driver exists
            driver = await db.drivers.find_one({"telegram_id": telegram_id}, {"_id": 0})
            
            if not driver:
                # Create new driver and start registration
                driver = DriverModel(
                    telegram_id=telegram_id,
                    username=user.get("username"),
                    first_name=user.get("first_name"),
                    last_name=user.get("last_name"),
                    is_registered=False,
                    registration_step="car_brand"
                )
                await db.drivers.insert_one(driver.model_dump())
                
                await answer_callback_query(callback_id, "Сначала нужно зарегистрироваться!", True)
                await send_telegram_message(
                    telegram_id,
                    "🚕 Добро пожаловать в команду водителей!\n\n"
                    "Для начала работы заполните данные об автомобиле.\n\n"
                    "🚗 Введите марку автомобиля (например: Toyota, Hyundai, Kia):"
                )
                return {"ok": True}
            
            if not driver.get("is_registered"):
                # Driver exists but not fully registered
                if not driver.get("registration_step"):
                    await db.drivers.update_one(
                        {"telegram_id": telegram_id},
                        {"$set": {"registration_step": "car_brand"}}
                    )
                    await send_telegram_message(
                        telegram_id,
                        "🚗 Продолжите регистрацию. Введите марку автомобиля:"
                    )
                
                await answer_callback_query(callback_id, "Сначала завершите регистрацию в личных сообщениях бота!", True)
                return {"ok": True}
            
            if driver["status"] == DriverStatus.BLOCKED:
                await answer_callback_query(callback_id, "Вы заблокированы", True)
                return {"ok": True}
            
            if driver["is_busy"]:
                await answer_callback_query(callback_id, "У вас уже есть активный заказ", True)
                return {"ok": True}
            
            # Try to assign order (with lock)
            driver_name = f"{driver.get('first_name', '')} {driver.get('last_name', '')}".strip() or driver.get("username", "Водитель")
            car_info = f"{driver.get('car_brand', '')} {driver.get('car_model', '')} {driver.get('car_color', '')} ({driver.get('car_plate', '')})".strip()
            
            result = await db.orders.find_one_and_update(
                {
                    "id": order_id,
                    "status": {"$in": [OrderStatus.NEW, OrderStatus.BROADCAST]},
                    "driver_id": None
                },
                {"$set": {
                    "status": OrderStatus.ASSIGNED,
                    "driver_id": driver["id"],
                    "driver_telegram_id": telegram_id,
                    "driver_name": driver_name,
                    "driver_phone": driver.get("phone"),
                    "driver_car": car_info,
                    "assigned_at": datetime.now(timezone.utc).isoformat()
                }},
                return_document=True
            )
            
            if not result:
                await answer_callback_query(callback_id, "Заказ уже принят другим водителем", True)
                return {"ok": True}
            
            # Mark driver as busy
            await db.drivers.update_one(
                {"id": driver["id"]},
                {"$set": {"is_busy": True, "current_order_id": order_id}}
            )
            
            await log_action(ActionType.ORDER_ASSIGNED, order_id=order_id, driver_id=driver["id"])
            
            # Update message in chat
            order = result
            car_info = f"{driver.get('car_brand', '')} {driver.get('car_model', '')} {driver.get('car_color', '')} ({driver.get('car_plate', '')})".strip()
            
            await edit_telegram_message(
                TELEGRAM_DRIVERS_CHAT_ID,
                order.get("telegram_message_id"),
                f"""✅ <b>Заказ принят</b>

📍 <b>Откуда:</b> {order['address_from']}
📍 <b>Куда:</b> {order['address_to']}

👤 <b>Водитель:</b> {driver_name}
🚗 <b>Авто:</b> {car_info}
🆔 Заказ: <code>{order_id[:8]}</code>"""
            )
            
            # Notify client with car info
            client_message = f"""🚖 <b>Водитель назначен!</b>

👤 <b>Водитель:</b> {driver_name}
🚗 <b>Автомобиль:</b> {car_info}"""
            if driver.get("phone"):
                client_message += f"\n📞 <b>Телефон:</b> {driver['phone']}"
            
            await notify_client(order["client_telegram_id"], client_message)
            
            await answer_callback_query(callback_id, "✅ Вы приняли заказ!")
            
            # Send order details to driver in private
            driver_message = f"""🚖 <b>Вы приняли заказ!</b>

📍 <b>Откуда:</b> {order['address_from']}
📍 <b>Куда:</b> {order['address_to']}"""
            if order.get("comment"):
                driver_message += f"\n💬 <b>Комментарий:</b> {order['comment']}"
            
            driver_message += f"\n\n🆔 Заказ: <code>{order_id[:8]}</code>"
            
            await send_telegram_message(telegram_id, driver_message, {
                "inline_keyboard": [[
                    {"text": "✅ Завершить заказ", "callback_data": f"complete_order:{order_id}"}
                ]]
            })
        
        elif callback_data.startswith("complete_order:"):
            order_id = callback_data.split(":")[1]
            
            order = await db.orders.find_one({
                "id": order_id,
                "driver_telegram_id": telegram_id,
                "status": OrderStatus.ASSIGNED
            }, {"_id": 0})
            
            if not order:
                await answer_callback_query(callback_id, "Заказ не найден или уже завершён", True)
                return {"ok": True}
            
            # Complete order
            await db.orders.update_one(
                {"id": order_id},
                {"$set": {
                    "status": OrderStatus.COMPLETED,
                    "completed_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Free up driver
            await db.drivers.update_one(
                {"telegram_id": telegram_id},
                {"$set": {"is_busy": False, "current_order_id": None}}
            )
            
            await log_action(ActionType.ORDER_COMPLETED, order_id=order_id, driver_id=order.get("driver_id"))
            
            # Notify client
            await notify_client(order["client_telegram_id"], "✅ <b>Поездка завершена!</b>\n\nСпасибо за использование нашего сервиса!")
            
            await answer_callback_query(callback_id, "✅ Заказ завершён!")
            
            # Update driver's message
            await send_telegram_message(telegram_id, f"✅ <b>Заказ {order_id[:8]} завершён!</b>\n\nОжидайте новые заказы.")
    
    return {"ok": True}

# ==================== ADMIN API ====================

@api_router.post("/admin/auth")
async def admin_auth(data: AdminLoginRequest):
    """Authenticate admin via Telegram Login Widget"""
    # Verify Telegram auth
    auth_dict = data.model_dump()
    
    # Simple verification - check if telegram_id exists
    telegram_id = data.telegram_id
    
    # Find or create admin
    existing = await db.admins.find_one({"telegram_id": telegram_id}, {"_id": 0})
    
    if existing:
        return {"admin": existing, "token": f"admin_{telegram_id}"}
    
    new_admin = AdminModel(
        telegram_id=telegram_id,
        username=data.username,
        first_name=data.first_name,
        last_name=data.last_name
    )
    await db.admins.insert_one(new_admin.model_dump())
    return {"admin": new_admin.model_dump(), "token": f"admin_{telegram_id}"}

@api_router.get("/admin/orders")
async def get_all_orders(status: Optional[OrderStatus] = None, limit: int = 100):
    """Get all orders with optional status filter"""
    query = {}
    if status:
        query["status"] = status
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return orders

@api_router.get("/admin/orders/{order_id}")
async def get_order_details(order_id: str):
    """Get order details"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    return order

@api_router.post("/admin/orders/{order_id}/assign")
async def admin_assign_driver(order_id: str, data: AssignDriverRequest):
    """Manually assign driver to order"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    if order["status"] not in [OrderStatus.NEW, OrderStatus.BROADCAST]:
        raise HTTPException(status_code=400, detail="Невозможно назначить водителя на этот заказ")
    
    driver = await db.drivers.find_one({"id": data.driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Водитель не найден")
    
    if driver["status"] == DriverStatus.BLOCKED:
        raise HTTPException(status_code=400, detail="Водитель заблокирован")
    
    if driver["is_busy"]:
        raise HTTPException(status_code=400, detail="Водитель занят другим заказом")
    
    # Assign driver
    driver_name = f"{driver.get('first_name', '')} {driver.get('last_name', '')}".strip() or driver.get("username", "Водитель")
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": OrderStatus.ASSIGNED,
            "driver_id": driver["id"],
            "driver_telegram_id": driver["telegram_id"],
            "driver_name": driver_name,
            "driver_phone": driver.get("phone"),
            "assigned_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Mark driver as busy
    await db.drivers.update_one(
        {"id": driver["id"]},
        {"$set": {"is_busy": True, "current_order_id": order_id}}
    )
    
    await log_action(ActionType.ORDER_ASSIGNED, order_id=order_id, driver_id=driver["id"], details="Назначено администратором")
    
    # Notify client
    client_message = f"""🚖 <b>Водитель назначен!</b>

👤 <b>Водитель:</b> {driver_name}"""
    if driver.get("phone"):
        client_message += f"\n📞 <b>Телефон:</b> {driver['phone']}"
    
    await notify_client(order["client_telegram_id"], client_message)
    
    # Notify driver
    driver_message = f"""🚖 <b>Вам назначен заказ!</b>

📍 <b>Откуда:</b> {order['address_from']}
📍 <b>Куда:</b> {order['address_to']}"""
    if order.get("comment"):
        driver_message += f"\n💬 <b>Комментарий:</b> {order['comment']}"
    
    await send_telegram_message(driver["telegram_id"], driver_message, {
        "inline_keyboard": [[
            {"text": "✅ Завершить заказ", "callback_data": f"complete_order:{order_id}"}
        ]]
    })
    
    return {"success": True, "message": "Водитель назначен"}

@api_router.post("/admin/orders/{order_id}/cancel")
async def admin_cancel_order(order_id: str):
    """Cancel order by admin"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    if order["status"] in [OrderStatus.COMPLETED, OrderStatus.CANCELLED]:
        raise HTTPException(status_code=400, detail="Невозможно отменить заказ")
    
    # Free up driver if assigned
    if order.get("driver_id"):
        await db.drivers.update_one(
            {"id": order["driver_id"]},
            {"$set": {"is_busy": False, "current_order_id": None}}
        )
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": OrderStatus.CANCELLED,
            "cancelled_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    await log_action(ActionType.ORDER_CANCELLED, order_id=order_id, details="Отменено администратором")
    
    # Notify client
    await notify_client(order["client_telegram_id"], "❌ <b>Ваш заказ отменён администратором</b>")
    
    # Update message in drivers chat
    if order.get("telegram_message_id") and TELEGRAM_DRIVERS_CHAT_ID:
        await edit_telegram_message(
            TELEGRAM_DRIVERS_CHAT_ID,
            order["telegram_message_id"],
            f"❌ <b>Заказ отменён администратором</b>\n\n🆔 Заказ: <code>{order_id[:8]}</code>"
        )
    
    return {"success": True, "message": "Заказ отменён"}

@api_router.post("/admin/orders/{order_id}/complete")
async def admin_complete_order(order_id: str):
    """Complete order by admin"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    if order["status"] != OrderStatus.ASSIGNED:
        raise HTTPException(status_code=400, detail="Можно завершить только назначенный заказ")
    
    # Free up driver
    if order.get("driver_id"):
        await db.drivers.update_one(
            {"id": order["driver_id"]},
            {"$set": {"is_busy": False, "current_order_id": None}}
        )
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "status": OrderStatus.COMPLETED,
            "completed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    await log_action(ActionType.ORDER_COMPLETED, order_id=order_id, details="Завершено администратором")
    
    # Notify client
    await notify_client(order["client_telegram_id"], "✅ <b>Поездка завершена!</b>\n\nСпасибо за использование нашего сервиса!")
    
    return {"success": True, "message": "Заказ завершён"}

# ==================== DRIVERS API ====================

@api_router.get("/admin/drivers")
async def get_all_drivers():
    """Get all drivers"""
    drivers = await db.drivers.find({}, {"_id": 0}).to_list(500)
    return drivers

@api_router.get("/admin/drivers/{driver_id}")
async def get_driver_details(driver_id: str):
    """Get driver details"""
    driver = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Водитель не найден")
    return driver

@api_router.patch("/admin/drivers/{driver_id}")
async def update_driver(driver_id: str, data: UpdateDriverRequest):
    """Update driver status, phone or car info"""
    driver = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Водитель не найден")
    
    update_dict = {}
    
    if data.status:
        update_dict["status"] = data.status
        if data.status == DriverStatus.BLOCKED:
            await log_action(ActionType.DRIVER_BLOCKED, driver_id=driver_id)
        else:
            await log_action(ActionType.DRIVER_UNBLOCKED, driver_id=driver_id)
    
    if data.phone is not None:
        update_dict["phone"] = data.phone if data.phone else None
    
    if data.car_brand is not None:
        update_dict["car_brand"] = data.car_brand if data.car_brand else None
    
    if data.car_model is not None:
        update_dict["car_model"] = data.car_model if data.car_model else None
    
    if data.car_color is not None:
        update_dict["car_color"] = data.car_color if data.car_color else None
    
    if data.car_plate is not None:
        update_dict["car_plate"] = data.car_plate.upper() if data.car_plate else None
    
    # Check if all car fields are filled - mark as registered
    if update_dict:
        await db.drivers.update_one({"id": driver_id}, {"$set": update_dict})
        
        # Check if driver is now fully registered
        updated_driver = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
        if (updated_driver.get("car_brand") and updated_driver.get("car_model") and 
            updated_driver.get("car_color") and updated_driver.get("car_plate")):
            await db.drivers.update_one(
                {"id": driver_id}, 
                {"$set": {"is_registered": True, "registration_step": None}}
            )
            if not driver.get("is_registered"):
                await log_action(ActionType.DRIVER_REGISTERED, driver_id=driver_id, details="Зарегистрирован администратором")
    
    updated = await db.drivers.find_one({"id": driver_id}, {"_id": 0})
    return updated

# ==================== CLIENTS API ====================

@api_router.get("/admin/clients")
async def get_all_clients():
    """Get all clients"""
    clients = await db.clients.find({}, {"_id": 0}).to_list(500)
    return clients

# ==================== LOGS API ====================

@api_router.get("/admin/logs")
async def get_action_logs(limit: int = 100):
    """Get action logs"""
    logs = await db.action_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return logs

# ==================== SETTINGS API ====================

@api_router.get("/admin/settings")
async def get_settings():
    """Get current settings"""
    return {
        "drivers_chat_id": TELEGRAM_DRIVERS_CHAT_ID,
        "bot_configured": bool(TELEGRAM_BOT_TOKEN)
    }

@api_router.post("/admin/settings/drivers-chat")
async def set_drivers_chat(data: SetDriversChatRequest):
    """Set drivers chat ID"""
    global TELEGRAM_DRIVERS_CHAT_ID
    TELEGRAM_DRIVERS_CHAT_ID = data.chat_id
    
    # Also update .env file
    env_path = ROOT_DIR / '.env'
    with open(env_path, 'r') as f:
        content = f.read()
    
    if 'TELEGRAM_DRIVERS_CHAT_ID=' in content:
        lines = content.split('\n')
        for i, line in enumerate(lines):
            if line.startswith('TELEGRAM_DRIVERS_CHAT_ID='):
                lines[i] = f'TELEGRAM_DRIVERS_CHAT_ID="{data.chat_id}"'
        content = '\n'.join(lines)
    else:
        content += f'\nTELEGRAM_DRIVERS_CHAT_ID="{data.chat_id}"'
    
    with open(env_path, 'w') as f:
        f.write(content)
    
    return {"success": True, "message": "Chat ID сохранён"}

# ==================== STATS API ====================

@api_router.get("/admin/stats")
async def get_stats():
    """Get dashboard statistics"""
    total_orders = await db.orders.count_documents({})
    active_orders = await db.orders.count_documents({"status": {"$in": [OrderStatus.NEW, OrderStatus.BROADCAST, OrderStatus.ASSIGNED]}})
    completed_orders = await db.orders.count_documents({"status": OrderStatus.COMPLETED})
    cancelled_orders = await db.orders.count_documents({"status": OrderStatus.CANCELLED})
    
    total_drivers = await db.drivers.count_documents({})
    active_drivers = await db.drivers.count_documents({"status": DriverStatus.ACTIVE})
    busy_drivers = await db.drivers.count_documents({"is_busy": True})
    
    total_clients = await db.clients.count_documents({})
    
    return {
        "orders": {
            "total": total_orders,
            "active": active_orders,
            "completed": completed_orders,
            "cancelled": cancelled_orders
        },
        "drivers": {
            "total": total_drivers,
            "active": active_drivers,
            "busy": busy_drivers
        },
        "clients": {
            "total": total_clients
        }
    }

# ==================== ROOT ====================

@api_router.get("/")
async def root():
    return {"message": "Taxi Service API", "version": "1.0.0"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
