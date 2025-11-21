import sqlite3

def fetch_data_from_database():
    conn = sqlite3.connect("database.db3")
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("""
        SELECT 
            p.product_id, 
            p.name AS product_name, 
            p.des AS product_des,
            p.image_url AS product_image_url,
            p.location_id AS product_location_id,
            p.tag AS product_tag,
                
            l.location_id,
            l.name AS location_name,
            l.max_long AS location_max_long,
            l.min_long AS location_min_long,
            l.max_lat AS location_max_lat,
            l.min_lat AS location_min_lat,
                
            s.store_id,
            s.name AS store_name,
            s.address AS store_address,
            s.lat AS store_lat,
            s.long AS store_long,
            s.location_id AS store_location_id,
            
            ps.ps_id,
            ps.store_id AS ps_store_id,
            ps.product_id AS ps_product_id,
            ps.cost AS ps_cost,
                
            pi.ps_id,
            pi.image_id AS ps_image_id,
            pi.image_url AS ps_image_url,
            pi.type AS ps_type

        FROM product p
        LEFT JOIN location l ON p.location_id = l.location_id
        LEFT JOIN product_store ps ON ps.product_id = p.product_id
        LEFT JOIN store s ON ps.store_id = s.store_id
        LEFT JOIN product_images pi ON pi.ps_id = ps.ps_id
    """)
    rows = cur.fetchall()
    conn.close()
    
    # ✅ Chuyển thành list of dicts
    return [dict(row) for row in rows]
