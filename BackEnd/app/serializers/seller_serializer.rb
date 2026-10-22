class SellerSerializer
  def initialize(seller)
    @seller = seller
  end

  def as_json
    {
      id: @seller.id,
      name: @seller.public_name.presence || "Maker ##{@seller.id}",
      image: @seller.image_url.presence,
      specialty: @seller.specialty.presence,
      bio: @seller.bio.presence
    }
  end
end
