exports.up = function(knex) {
    return knex.schema
        .createTable('businesses', table => {
            table.increments('id').primary();
            table.string('name').notNullable();
            table.string('description', 1000);
            table.float('latitude').notNullable();
            table.float('longitude').notNullable();
            table.float('sentiment_score').defaultTo(0);
            table.integer('visit_count').defaultTo(0);
            table.jsonb('badges').defaultTo('[]');
            table.jsonb('aspect_sentiment').defaultTo('{}');
            table.timestamps(true, true);
        })
        .createTable('reviews', table => {
            table.increments('id').primary();
            table.integer('business_id').references('businesses.id').onDelete('CASCADE');
            table.text('content').notNullable();
            table.float('sentiment_score');
            table.jsonb('aspect_analysis');
            table.timestamp('review_date').defaultTo(knex.fn.now());
            table.timestamps(true, true);
        })
        .createTable('photos', table => {
            table.increments('id').primary();
            table.integer('business_id').references('businesses.id').onDelete('CASCADE');
            table.string('url').notNullable();
            table.string('thumbnail_url');
            table.string('caption');
            table.string('uploaded_by');
            table.timestamps(true, true);
        });
};

exports.down = function(knex) {
    return knex.schema
        .dropTableIfExists('photos')
        .dropTableIfExists('reviews')
        .dropTableIfExists('businesses');
}; 